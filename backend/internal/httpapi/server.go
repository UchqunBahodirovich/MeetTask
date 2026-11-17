package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"meettask/backend/internal/analysis"
	"meettask/backend/internal/auth"
	"meettask/backend/internal/config"
	"meettask/backend/internal/domain"
	"meettask/backend/internal/googleauth"
	"meettask/backend/internal/soniox"
	"meettask/backend/internal/store"
)

const maxUploadBytes = 200 << 20

type identityKey struct{}

type Server struct {
	Config   config.Config
	Store    *store.Store
	Auth     auth.Manager
	Analysis analysis.Service
	Soniox   soniox.Client
	Logger   *slog.Logger
	// Google sign-in is optional: when no verifier is configured the endpoint
	// reports it is unavailable and email/password keeps working.
	Google  googleauth.Verifier
	limiter *rateLimiter
}

func New(cfg config.Config, db *store.Store, logger *slog.Logger) *Server {
	return &Server{Config: cfg, Store: db, Logger: logger,
		Auth:     auth.Manager{JWTSecret: []byte(cfg.JWTSecret), RefreshSecret: []byte(cfg.RefreshSecret), AccessTTL: cfg.AccessTTL, RefreshTTL: cfg.RefreshTTL},
		Analysis: analysis.Service{APIKey: cfg.OpenAIAPIKey, Model: cfg.OpenAIModel, ChunkChars: cfg.AnalyzeChunkChars},
		Soniox:   soniox.Client{APIKey: cfg.SonioxAPIKey}, limiter: newRateLimiter(),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/google", s.googleLogin)
	mux.HandleFunc("POST /api/auth/refresh", s.refresh)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.Handle("GET /api/auth/me", s.protected(http.HandlerFunc(s.me)))
	mux.Handle("GET /api/workspaces/{id}/members", s.protected(http.HandlerFunc(s.listMembers)))
	mux.Handle("POST /api/workspaces/{id}/members", s.protected(http.HandlerFunc(s.addMember)))
	mux.Handle("PATCH /api/workspaces/{id}/members/{userId}", s.protected(http.HandlerFunc(s.updateMember)))
	mux.Handle("DELETE /api/workspaces/{id}/members/{userId}", s.protected(http.HandlerFunc(s.removeMember)))
	mux.Handle("GET /api/meetings", s.protected(http.HandlerFunc(s.listMeetings)))
	mux.Handle("POST /api/meetings", s.protected(http.HandlerFunc(s.createMeeting)))
	mux.Handle("GET /api/meetings/{id}", s.protected(http.HandlerFunc(s.getMeeting)))
	mux.Handle("PATCH /api/meetings/{id}", s.protected(http.HandlerFunc(s.updateMeeting)))
	mux.Handle("DELETE /api/meetings/{id}", s.protected(http.HandlerFunc(s.deleteMeeting)))
	mux.Handle("POST /api/meetings/{id}/reanalyze", s.protected(s.rateLimited("reanalyze", 20, time.Hour, http.HandlerFunc(s.reanalyze))))
	mux.Handle("GET /api/tasks", s.protected(http.HandlerFunc(s.listTasks)))
	mux.Handle("POST /api/tasks", s.protected(http.HandlerFunc(s.createTask)))
	mux.Handle("PATCH /api/tasks/{id}", s.protected(http.HandlerFunc(s.updateTask)))
	mux.Handle("DELETE /api/tasks/{id}", s.protected(http.HandlerFunc(s.deleteTask)))
	mux.Handle("POST /api/tasks/{id}/approve", s.protected(http.HandlerFunc(s.approveTask)))
	mux.Handle("GET /api/settings", s.protected(http.HandlerFunc(s.settings)))
	mux.Handle("PUT /api/settings", s.protected(http.HandlerFunc(s.updateSettings)))
	mux.Handle("GET /api/notifications", s.protected(http.HandlerFunc(s.notifications)))
	mux.Handle("POST /api/notifications/read", s.protected(http.HandlerFunc(s.readNotifications)))
	mux.Handle("POST /api/transcription/temporary-key", s.serviceProtected(http.HandlerFunc(s.temporaryKey)))
	mux.Handle("POST /api/meetings/transcribe", s.serviceProtected(s.rateLimited("transcription", 10, time.Hour, http.HandlerFunc(s.startTranscription))))
	mux.Handle("GET /api/meetings/transcribe/{id}", s.serviceProtected(http.HandlerFunc(s.getTranscription)))
	// Live meetings scan every few seconds, so this budget has to cover an hour
	// of continuous scanning plus the final analysis — 10/hour blocked a single
	// demo after two minutes.
	mux.Handle("POST /api/analyze", s.serviceProtected(s.rateLimited("analysis", 400, time.Hour, http.HandlerFunc(s.analyze))))
	return s.recoverer(s.cors(s.securityHeaders(mux)))
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true, "services": map[string]bool{
		"transcription": s.Config.SonioxAPIKey != "", "analysis": s.Config.OpenAIAPIKey != "", "firestore": s.Store != nil,
	}})
}

type registerRequest struct {
	Name          string `json:"name"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	WorkspaceName string `json:"workspaceName"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var body registerRequest
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	body.Name, body.Email, body.WorkspaceName = strings.TrimSpace(body.Name), strings.TrimSpace(body.Email), strings.TrimSpace(body.WorkspaceName)
	if len(body.Name) < 2 || !strings.Contains(body.Email, "@") || len(body.WorkspaceName) < 2 {
		writeError(w, 400, "Ism, email va workspace nomini to‘g‘ri kiriting.")
		return
	}
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	user, workspace, err := s.Store.CreateAccount(r.Context(), body.Name, body.Email, hash, body.WorkspaceName)
	if err != nil {
		writeError(w, 409, err.Error())
		return
	}
	s.finishLogin(w, r, user, workspace.ID, domain.Owner, http.StatusCreated)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body loginRequest
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	user, hash, err := s.Store.FindUserByEmail(r.Context(), body.Email)
	if err != nil || !auth.VerifyPassword(hash, body.Password) {
		writeError(w, 401, "Email yoki parol noto‘g‘ri.")
		return
	}
	workspaceID, role, err := s.Store.FirstMembership(r.Context(), user.ID)
	if err != nil {
		writeError(w, 403, "Foydalanuvchi workspace’ga biriktirilmagan.")
		return
	}
	s.finishLogin(w, r, user, workspaceID, role, http.StatusOK)
}

type googleRequest struct {
	IDToken       string `json:"idToken"`
	WorkspaceName string `json:"workspaceName"`
}

// googleLogin trades a Firebase ID token for this API's own session.
//
// Three cases have to work: an existing password account with the same email,
// a member who was invited but has never signed in, and a brand new person who
// needs a workspace of their own.
func (s *Server) googleLogin(w http.ResponseWriter, r *http.Request) {
	if s.Google == nil {
		writeError(w, 503, "Google orqali kirish sozlanmagan.")
		return
	}
	var body googleRequest
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	if strings.TrimSpace(body.IDToken) == "" {
		writeError(w, 400, "Google tokeni yuborilmadi.")
		return
	}

	identity, err := s.Google.Verify(r.Context(), body.IDToken)
	if err != nil {
		writeError(w, 401, err.Error())
		return
	}

	user, _, findErr := s.Store.FindUserByEmail(r.Context(), identity.Email)
	if findErr == nil {
		workspaceID, role, membershipErr := s.Store.FirstMembership(r.Context(), user.ID)
		if membershipErr != nil {
			writeError(w, 403, "Foydalanuvchi workspace‘ga biriktirilmagan.")
			return
		}
		s.finishLogin(w, r, user, workspaceID, role, http.StatusOK)
		return
	}

	// New person: give them a workspace so they are not left with an account
	// that cannot hold anything.
	workspaceName := strings.TrimSpace(body.WorkspaceName)
	if workspaceName == "" {
		workspaceName = identity.Name
	}
	// Google accounts never sign in with a password, so store an unusable one
	// rather than leaving the field empty.
	placeholder, err := auth.HashPassword(uuid.NewString() + uuid.NewString())
	if err != nil {
		writeError(w, 500, "Hisob yaratilmadi.")
		return
	}
	created, workspace, createErr := s.Store.CreateAccount(r.Context(), identity.Name, identity.Email, placeholder, workspaceName)
	if createErr != nil {
		writeError(w, 409, createErr.Error())
		return
	}
	s.finishLogin(w, r, created, workspace.ID, domain.Owner, http.StatusCreated)
}

func (s *Server) finishLogin(w http.ResponseWriter, r *http.Request, user domain.User, workspaceID string, role domain.AccessRole, status int) {
	tokens, err := s.Auth.Issue(user.ID, workspaceID, string(role))
	if err != nil {
		writeError(w, 500, "Sessiya yaratilmadi.")
		return
	}
	if err := s.Store.SaveRefresh(r.Context(), tokens.RefreshID, user.ID, tokens.RefreshHash, tokens.ExpiresAt); err != nil {
		writeError(w, 500, "Sessiya saqlanmadi.")
		return
	}
	s.setRefreshCookie(w, tokens.RefreshToken, tokens.ExpiresAt)
	writeJSON(w, status, map[string]any{"accessToken": tokens.AccessToken, "user": user, "workspaceId": workspaceID, "accessRole": role})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("meettask_refresh")
	if err != nil {
		writeError(w, 401, "Refresh cookie topilmadi.")
		return
	}
	claims, err := s.Auth.ParseRefresh(cookie.Value)
	if err != nil || s.Store.ConsumeRefresh(r.Context(), claims.ID, claims.Subject, auth.RefreshHash(cookie.Value)) != nil {
		s.clearRefreshCookie(w)
		writeError(w, 401, "Sessiya tugagan.")
		return
	}
	role, err := s.Store.Membership(r.Context(), claims.WorkspaceID, claims.Subject)
	if err != nil {
		writeError(w, 403, "Workspace a’zoligi topilmadi.")
		return
	}
	user, err := s.Store.User(r.Context(), claims.Subject)
	if err != nil {
		writeError(w, 401, "Foydalanuvchi topilmadi.")
		return
	}
	s.finishLogin(w, r, user, claims.WorkspaceID, role, http.StatusOK)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("meettask_refresh"); err == nil {
		if claims, err := s.Auth.ParseRefresh(cookie.Value); err == nil {
			_ = s.Store.RevokeRefresh(r.Context(), claims.ID)
		}
	}
	s.clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	user, err := s.Store.User(r.Context(), id.UserID)
	if err != nil {
		writeError(w, 404, "Foydalanuvchi topilmadi.")
		return
	}
	writeJSON(w, 200, map[string]any{"user": user, "workspaceId": id.WorkspaceID, "accessRole": id.AccessRole})
}

func (s *Server) listMembers(w http.ResponseWriter, r *http.Request) {
	if !s.sameWorkspace(w, r, r.PathValue("id")) {
		return
	}
	members, err := s.Store.Members(r.Context(), identity(r).WorkspaceID)
	respond(w, members, err)
}

func (s *Server) addMember(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !s.sameWorkspace(w, r, r.PathValue("id")) || !requireAction(w, id, domain.ManageMembers) {
		return
	}
	var body struct {
		Email      string            `json:"email"`
		Name       string            `json:"name"`
		Role       *string           `json:"role"`
		AccessRole domain.AccessRole `json:"accessRole"`
	}
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	if body.AccessRole == "" {
		body.AccessRole = domain.Member
	}
	if !validAccessRole(body.AccessRole) {
		writeError(w, 400, "accessRole noto‘g‘ri.")
		return
	}
	body.Email, body.Name = strings.TrimSpace(body.Email), strings.TrimSpace(body.Name)
	if body.Email != "" && !strings.Contains(body.Email, "@") {
		writeError(w, 400, "Email manzilini to‘g‘ri kiriting.")
		return
	}
	if body.Name == "" && body.Email != "" {
		body.Name = strings.Split(body.Email, "@")[0]
	}
	if len([]rune(body.Name)) < 2 || len([]rune(body.Name)) > 80 {
		writeError(w, 400, "A’zoning ismini kiriting.")
		return
	}
	if body.Role != nil {
		role := strings.TrimSpace(*body.Role)
		if len([]rune(role)) > 60 {
			writeError(w, 400, "Lavozim juda uzun.")
			return
		}
		if role == "" {
			body.Role = nil
		} else {
			body.Role = &role
		}
	}
	// Invited members get a random password nobody knows until they claim the account.
	unusable, err := auth.HashPassword(uuid.NewString())
	if err != nil {
		writeError(w, 500, "A’zoni qo‘shib bo‘lmadi.")
		return
	}
	member, err := s.Store.AddMember(r.Context(), id.WorkspaceID, body.Email, body.Name, body.Role, body.AccessRole, unusable)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, member)
}

func (s *Server) updateMember(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !s.sameWorkspace(w, r, r.PathValue("id")) || !requireAction(w, id, domain.ManageMembers) || !validUUID(w, r.PathValue("userId")) {
		return
	}
	var body struct {
		AccessRole *domain.AccessRole `json:"accessRole"`
		Role       *string            `json:"role"`
		Name       *string            `json:"name"`
	}
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	if body.AccessRole != nil && !validAccessRole(*body.AccessRole) {
		writeError(w, 400, "accessRole noto‘g‘ri.")
		return
	}
	if body.Role != nil {
		role := strings.TrimSpace(*body.Role)
		if len([]rune(role)) > 60 {
			writeError(w, 400, "Lavozim juda uzun.")
			return
		}
		body.Role = &role
	}
	if body.Name != nil {
		name := strings.TrimSpace(*body.Name)
		if len([]rune(name)) < 2 || len([]rune(name)) > 80 {
			writeError(w, 400, "A’zoning ismini kiriting.")
			return
		}
		body.Name = &name
	}
	if err := s.Store.UpdateMember(r.Context(), id.WorkspaceID, r.PathValue("userId"), body.AccessRole, body.Role, body.Name); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	w.WriteHeader(204)
}

func (s *Server) removeMember(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !s.sameWorkspace(w, r, r.PathValue("id")) || !requireAction(w, id, domain.ManageMembers) || !validUUID(w, r.PathValue("userId")) {
		return
	}
	if err := s.Store.RemoveMember(r.Context(), id.WorkspaceID, r.PathValue("userId")); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	w.WriteHeader(204)
}

type meetingRequest struct {
	Title          string                  `json:"title"`
	Date           string                  `json:"date"`
	Duration       string                  `json:"duration"`
	Status         string                  `json:"status"`
	Summary        *string                 `json:"summary"`
	KeyPoints      []string                `json:"keyPoints"`
	Decisions      []string                `json:"decisions"`
	ParticipantIDs []string                `json:"participantIds"`
	Transcript     []domain.TranscriptLine `json:"transcript"`
}

func (s *Server) listMeetings(w http.ResponseWriter, r *http.Request) {
	meetings, err := s.Store.Meetings(r.Context(), identity(r).WorkspaceID, r.URL.Query().Get("status"), r.URL.Query().Get("q"), auth.ParsePositive(r.URL.Query().Get("limit"), 50, 200))
	respond(w, meetings, err)
}

func (s *Server) createMeeting(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !requireAction(w, id, domain.CreateMeeting) {
		return
	}
	var body meetingRequest
	if !decodeJSON(w, r, &body, 4<<20) {
		return
	}
	date, err := time.Parse(time.RFC3339, body.Date)
	if err != nil || strings.TrimSpace(body.Title) == "" || !validMeetingStatus(body.Status) {
		writeError(w, 400, "Yig‘ilish nomi, sanasi yoki statusi noto‘g‘ri.")
		return
	}
	meeting, err := s.Store.CreateMeeting(r.Context(), domain.Meeting{WorkspaceID: id.WorkspaceID, Title: strings.TrimSpace(body.Title), Date: date,
		Duration: body.Duration, Status: body.Status, Summary: body.Summary, KeyPoints: body.KeyPoints, Decisions: body.Decisions, CreatedBy: id.UserID}, body.ParticipantIDs)
	if err == nil && len(body.Transcript) > 0 {
		err = s.Store.ReplaceTranscript(r.Context(), id.WorkspaceID, meeting.ID, body.Transcript)
	}
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, meeting)
}

func (s *Server) getMeeting(w http.ResponseWriter, r *http.Request) {
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	meeting, err := s.Store.Meeting(r.Context(), identity(r).WorkspaceID, r.PathValue("id"), true)
	respond(w, meeting, err)
}

func (s *Server) updateMeeting(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if id.AccessRole == domain.Guest {
		writeError(w, 403, "Bu amal uchun ruxsat yo‘q.")
		return
	}
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	var values map[string]any
	if !decodeJSON(w, r, &values, 4<<20) {
		return
	}

	// Transcript lines live in their own collection, so they travel separately
	// from the meeting document's scalar fields.
	if raw, ok := values["transcript"]; ok {
		delete(values, "transcript")
		encoded, marshalErr := json.Marshal(raw)
		var lines []domain.TranscriptLine
		if marshalErr == nil {
			marshalErr = json.Unmarshal(encoded, &lines)
		}
		if marshalErr != nil {
			writeError(w, 400, "Transkript formati noto‘g‘ri.")
			return
		}
		if err := s.Store.ReplaceTranscript(r.Context(), id.WorkspaceID, r.PathValue("id"), lines); err != nil {
			writeError(w, statusFor(err), err.Error())
			return
		}
	}

	if _, err := s.Store.UpdateMeeting(r.Context(), id.WorkspaceID, r.PathValue("id"), values); err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	// Return the full record so the client keeps the transcript it just saved.
	meeting, err := s.Store.Meeting(r.Context(), id.WorkspaceID, r.PathValue("id"), true)
	respond(w, meeting, err)
}

func (s *Server) deleteMeeting(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if id.AccessRole != domain.Owner && id.AccessRole != domain.Admin {
		writeError(w, 403, "Bu amal uchun ruxsat yo‘q.")
		return
	}
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	if err := s.Store.DeleteMeeting(r.Context(), id.WorkspaceID, r.PathValue("id")); err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	w.WriteHeader(204)
}

type taskRequest struct {
	MeetingID      *string  `json:"meetingId"`
	Title          string   `json:"title"`
	Description    *string  `json:"description"`
	AssigneeID     *string  `json:"assigneeId"`
	AssigneeIDs    []string `json:"assigneeIds"`
	AssigneeSource *string  `json:"assigneeSource"`
	AssignmentRole *string  `json:"assignmentRole"`
	Deadline       string   `json:"deadline"`
	Priority       string   `json:"priority"`
	Status         string   `json:"status"`
	OrderIndex     float64  `json:"orderIndex"`
	IsAIGenerated  bool     `json:"isAiGenerated"`
	IsApproved     *bool    `json:"isApproved"`
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	id, q := identity(r), r.URL.Query()
	tasks, err := s.Store.Tasks(r.Context(), id.WorkspaceID, map[string]string{
		"status": q.Get("status"), "assignee": q.Get("assignee"), "meeting": q.Get("meeting"), "priority": q.Get("priority"), "q": q.Get("q"),
	}, auth.ParsePositive(q.Get("limit"), 100, 300))
	if err == nil && id.AccessRole == domain.Guest {
		filtered := tasks[:0]
		for _, task := range tasks {
			if task.MeetingID == nil {
				continue
			}
			meeting, getErr := s.Store.Meeting(r.Context(), id.WorkspaceID, *task.MeetingID, false)
			if getErr == nil && slices.ContainsFunc(meeting.Participants, func(user domain.User) bool { return user.ID == id.UserID }) {
				filtered = append(filtered, task)
			}
		}
		tasks = filtered
	}
	respond(w, tasks, err)
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if id.AccessRole == domain.Guest {
		writeError(w, 403, "Bu amal uchun ruxsat yo‘q.")
		return
	}
	var body taskRequest
	if !decodeJSON(w, r, &body, 1<<20) || !validTask(body.Title, body.Priority, body.Status) {
		writeError(w, 400, "Task maydonlari noto‘g‘ri.")
		return
	}
	task, err := s.Store.CreateTask(r.Context(), domain.Task{WorkspaceID: id.WorkspaceID, MeetingID: body.MeetingID, Title: strings.TrimSpace(body.Title),
		Description: body.Description, AssigneeID: body.AssigneeID, AssigneeIDs: body.AssigneeIDs, AssigneeSource: body.AssigneeSource,
		AssignmentRole: body.AssignmentRole, Deadline: body.Deadline, Priority: body.Priority, Status: body.Status,
		OrderIndex: body.OrderIndex, CreatedBy: id.UserID,
		// An AI-extracted task stays unapproved until a person confirms it.
		IsAIGenerated: body.IsAIGenerated,
		IsApproved:    body.IsApproved == nil || *body.IsApproved})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, task)
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	task, err := s.Store.Task(r.Context(), id.WorkspaceID, r.PathValue("id"))
	if err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	var values map[string]any
	if !decodeJSON(w, r, &values, 1<<20) {
		return
	}
	if _, changingStatus := values["status"]; changingStatus {
		if !domain.CanChangeTaskStatus(id, task) {
			writeError(w, 403, "Task statusini o‘zgartirishga ruxsat yo‘q.")
			return
		}
	} else if !domain.CanEditTask(id, task) {
		writeError(w, 403, "Taskni tahrirlashga ruxsat yo‘q.")
		return
	}
	updated, err := s.Store.UpdateTask(r.Context(), id.WorkspaceID, task.ID, values)
	respond(w, updated, err)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	task, err := s.Store.Task(r.Context(), id.WorkspaceID, r.PathValue("id"))
	if err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	if !domain.CanDeleteTask(id, task) {
		writeError(w, 403, "Taskni o‘chirishga ruxsat yo‘q.")
		return
	}
	if err := s.Store.DeleteTask(r.Context(), id.WorkspaceID, task.ID); err != nil {
		writeError(w, 500, "Task o‘chirilmadi.")
		return
	}
	w.WriteHeader(204)
}

func (s *Server) approveTask(w http.ResponseWriter, r *http.Request) {
	id := identity(r)
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	task, err := s.Store.Task(r.Context(), id.WorkspaceID, r.PathValue("id"))
	if err != nil || !domain.CanEditTask(id, task) {
		writeError(w, 403, "Taskni tasdiqlashga ruxsat yo‘q.")
		return
	}
	updated, err := s.Store.UpdateTask(r.Context(), id.WorkspaceID, task.ID, map[string]any{"isApproved": true})
	respond(w, updated, err)
}

func (s *Server) settings(w http.ResponseWriter, r *http.Request) {
	result, err := s.Store.Settings(r.Context(), identity(r).UserID)
	respond(w, result, err)
}

func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	var values map[string]any
	if !decodeJSON(w, r, &values, 1<<20) {
		return
	}
	result, err := s.Store.UpdateSettings(r.Context(), identity(r).UserID, values)
	respond(w, result, err)
}

func (s *Server) notifications(w http.ResponseWriter, r *http.Request) {
	result, err := s.Store.Notifications(r.Context(), identity(r).UserID)
	respond(w, result, err)
}

func (s *Server) readNotifications(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	if err := s.Store.ReadNotifications(r.Context(), identity(r).UserID, body.IDs); err != nil {
		writeError(w, 500, "Bildirishnomalar yangilanmadi.")
		return
	}
	w.WriteHeader(204)
}

func (s *Server) analyze(w http.ResponseWriter, r *http.Request) {
	if !requireAction(w, identity(r), domain.AnalyzeMeeting) {
		return
	}
	var body analysis.Request
	if !decodeJSON(w, r, &body, 8<<20) {
		return
	}
	if len(strings.TrimSpace(body.Transcript)) < 2 || len(body.Transcript) > 1_000_000 {
		writeError(w, 400, "Tahlil uchun yaroqli transkript kerak.")
		return
	}
	wantsStream := strings.Contains(r.Header.Get("Accept"), "application/x-ndjson")
	if wantsStream {
		w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(200)
		writeNDJSON(w, map[string]any{"type": "start", "chunks": len(analysis.ChunkTranscript(body.Transcript, s.Config.AnalyzeChunkChars))})
	}
	result, err := s.Analysis.Analyze(r.Context(), body, func(index, total int) {
		if wantsStream {
			writeNDJSON(w, map[string]any{"type": "progress", "index": index, "total": total})
		}
	})
	if err != nil {
		s.Logger.Error("analysis failed", "error", err)
		if wantsStream {
			writeNDJSON(w, map[string]any{"type": "error", "error": "Matn tahlili yakunlanmadi."})
		} else {
			writeError(w, 502, "Matn tahlili yakunlanmadi.")
		}
		return
	}
	if wantsStream {
		writeNDJSON(w, map[string]any{"type": "result", "analysis": result})
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) reanalyze(w http.ResponseWriter, r *http.Request) {
	id, meetingID := identity(r), r.PathValue("id")
	if !validUUID(w, meetingID) || !requireAction(w, id, domain.AnalyzeMeeting) {
		return
	}
	meeting, err := s.Store.Meeting(r.Context(), id.WorkspaceID, meetingID, true)
	if err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	if id.AccessRole == domain.Member && meeting.CreatedBy != id.UserID {
		writeError(w, 403, "Faqat o‘zingiz yaratgan yig‘ilishni qayta tahlil qilishingiz mumkin.")
		return
	}
	var lines []string
	for _, line := range meeting.Transcript {
		lines = append(lines, fmt.Sprintf("[%s] %s: %s", line.Timestamp, line.Speaker, line.Text))
	}
	request := analysis.Request{Mode: meeting.AnalysisMode, Title: meeting.Title, MeetingDate: meeting.Date.Format("2006-01-02"), Transcript: strings.Join(lines, "\n"), OutputLanguage: "uz"}
	for _, participant := range meeting.Participants {
		request.Participants = append(request.Participants, analysis.Participant{ID: participant.ID, Name: participant.Name, Role: participant.Role})
	}
	result, err := s.Analysis.Analyze(r.Context(), request, nil)
	if err != nil {
		writeError(w, 502, "Qayta tahlil yakunlanmadi.")
		return
	}
	created, err := s.Store.ReplaceAITasks(r.Context(), id.WorkspaceID, meetingID, id.UserID, analysisTasks(result.Tasks))
	if err == nil {
		_, err = s.Store.UpdateMeeting(r.Context(), id.WorkspaceID, meetingID, map[string]any{"summary": result.Summary, "keyPoints": result.KeyPoints, "decisions": result.Decisions})
	}
	if err != nil {
		writeError(w, 500, "Analiz natijasi saqlanmadi.")
		return
	}
	writeJSON(w, 200, map[string]any{"analysis": result, "tasks": created})
}

func analysisTasks(tasks []analysis.Task) []domain.Task {
	result := make([]domain.Task, 0, len(tasks))
	for index, task := range tasks {
		deadline := "Belgilanmagan"
		if task.Deadline != nil {
			deadline = *task.Deadline
		}
		var source *string
		if task.AssignmentBasis == "named" {
			value := "stated"
			source = &value
		} else if task.AssignmentBasis == "role" {
			value := "role"
			source = &value
		}
		result = append(result, domain.Task{Title: task.Title, Description: &task.Description, AssigneeIDs: task.AssigneeIDs,
			AssigneeSource: source, AssignmentRole: task.SuggestedRole, Deadline: deadline, Priority: task.Priority,
			Status: "todo", OrderIndex: float64(index)})
	}
	return result
}

func (s *Server) temporaryKey(w http.ResponseWriter, r *http.Request) {
	if !requireAction(w, identity(r), domain.CreateMeeting) {
		return
	}
	if s.Config.SonioxAPIKey == "" {
		writeError(w, 503, "Transkripsiya xizmati serverda sozlanmagan.")
		return
	}
	var body struct {
		MeetingID string `json:"meetingId"`
	}
	if !decodeJSON(w, r, &body, 1<<20) {
		return
	}
	result, status, err := s.Soniox.TemporaryKey(r.Context(), body.MeetingID)
	providerRespond(w, result, status, err)
}

func (s *Server) startTranscription(w http.ResponseWriter, r *http.Request) {
	if !requireAction(w, identity(r), domain.AnalyzeMeeting) {
		return
	}
	if r.Header.Get("Content-Type") != "application/octet-stream" {
		writeError(w, 415, "Content-Type application/octet-stream bo‘lishi kerak.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	data, err := io.ReadAll(r.Body)
	if err != nil || len(data) == 0 {
		writeError(w, 400, "Audio fayl yuborilmadi yoki juda katta.")
		return
	}
	filename := "recording"
	if raw := r.Header.Get("X-File-Name"); raw != "" {
		if decoded, err := url.QueryUnescape(raw); err == nil {
			filename = decoded
		}
	}
	filename = strings.NewReplacer("/", "_", "\\", "_").Replace(filename)
	if len(filename) > 200 {
		filename = filename[:200]
	}
	hints := strings.FieldsFunc(r.Header.Get("X-Language-Hints"), func(r rune) bool { return r == ',' })
	if len(hints) > 5 {
		hints = hints[:5]
	}
	result, status, err := s.Soniox.StartTranscription(r.Context(), filename, data, hints)
	providerRespond(w, result, status, err)
}

func (s *Server) getTranscription(w http.ResponseWriter, r *http.Request) {
	if !validUUID(w, r.PathValue("id")) {
		return
	}
	result, status, err := s.Soniox.Transcription(r.Context(), r.PathValue("id"))
	providerRespond(w, result, status, err)
}

func providerRespond(w http.ResponseWriter, result map[string]any, status int, err error) {
	if err != nil {
		if status < 400 {
			status = 502
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, status, result)
}

func (s *Server) protected(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := s.Auth.ParseAccess(auth.Bearer(r.Header.Get("Authorization")))
		if err != nil {
			writeError(w, 401, "Avtorizatsiya talab qilinadi.")
			return
		}
		role, err := s.Store.Membership(r.Context(), claims.WorkspaceID, claims.Subject)
		if err != nil || string(role) != claims.AccessRole {
			writeError(w, 403, "Workspace a’zoligi yaroqsiz.")
			return
		}
		id := domain.Identity{UserID: claims.Subject, WorkspaceID: claims.WorkspaceID, AccessRole: role}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey{}, id)))
	})
}

func (s *Server) serviceProtected(next http.Handler) http.Handler {
	protected := s.protected(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth.Bearer(r.Header.Get("Authorization")) == "" && s.Config.AllowLegacyAPI {
			legacy := domain.Identity{UserID: "legacy-local-user", WorkspaceID: "legacy-local-workspace", AccessRole: domain.Member}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey{}, legacy)))
			return
		}
		protected.ServeHTTP(w, r)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, allowed := s.Config.CORSOrigins[origin]; !allowed {
				writeError(w, 403, "Origin ruxsat etilmagan.")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name, X-Language-Hints")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.Logger.Error("request panic", "error", recovered)
				writeError(w, 500, "Ichki server xatosi.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) setRefreshCookie(w http.ResponseWriter, value string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{Name: "meettask_refresh", Value: value, Path: "/api/auth", HttpOnly: true,
		Secure: s.Config.CookieSecure, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: int(time.Until(expires).Seconds())})
}

func (s *Server) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: "meettask_refresh", Path: "/api/auth", HttpOnly: true,
		Secure: s.Config.CookieSecure, SameSite: http.SameSiteStrictMode, Expires: time.Unix(0, 0), MaxAge: -1})
}

func (s *Server) sameWorkspace(w http.ResponseWriter, r *http.Request, workspaceID string) bool {
	if !validUUID(w, workspaceID) || identity(r).WorkspaceID != workspaceID {
		writeError(w, 404, "Workspace topilmadi.")
		return false
	}
	return true
}

func identity(r *http.Request) domain.Identity {
	return r.Context().Value(identityKey{}).(domain.Identity)
}

func requireAction(w http.ResponseWriter, identity domain.Identity, action domain.Action) bool {
	if !domain.Allowed(identity.AccessRole, action) {
		writeError(w, 403, "Bu amal uchun ruxsat yo‘q.")
		return false
	}
	return true
}

func validUUID(w http.ResponseWriter, value string) bool {
	if _, err := uuid.Parse(value); err != nil {
		writeError(w, 400, "Identifikator noto‘g‘ri.")
		return false
	}
	return true
}

func validAccessRole(role domain.AccessRole) bool {
	return role == domain.Owner || role == domain.Admin || role == domain.Member || role == domain.Guest
}

func validMeetingStatus(status string) bool {
	return status == "upcoming" || status == "live" || status == "completed"
}

func validTask(title, priority, status string) bool {
	return strings.TrimSpace(title) != "" && slices.Contains([]string{"low", "medium", "high"}, priority) &&
		slices.Contains([]string{"todo", "in-progress", "review", "completed"}, status)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(w, 400, "So‘rov ma’lumoti noto‘g‘ri.")
		return false
	}
	return true
}

func respond(w http.ResponseWriter, result any, err error) {
	if err != nil {
		writeError(w, statusFor(err), err.Error())
		return
	}
	writeJSON(w, 200, result)
}

func statusFor(err error) int {
	if errors.Is(err, store.ErrNotFound) {
		return 404
	}
	return 500
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeNDJSON(w http.ResponseWriter, value any) {
	_ = json.NewEncoder(w).Encode(value)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string][]time.Time
}

func newRateLimiter() *rateLimiter { return &rateLimiter{buckets: make(map[string][]time.Time)} }

func (s *Server) rateLimited(scope string, limit int, window time.Duration, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := identity(r)
		key, now := scope+":"+id.UserID, time.Now()
		s.limiter.mu.Lock()
		entries := s.limiter.buckets[key][:0]
		for _, entry := range s.limiter.buckets[key] {
			if now.Sub(entry) < window {
				entries = append(entries, entry)
			}
		}
		if len(entries) >= limit {
			s.limiter.buckets[key] = entries
			s.limiter.mu.Unlock()
			writeError(w, 429, "So‘rovlar limiti tugadi. Keyinroq urinib ko‘ring.")
			return
		}
		s.limiter.buckets[key] = append(entries, now)
		s.limiter.mu.Unlock()
		next.ServeHTTP(w, r)
	})
}
