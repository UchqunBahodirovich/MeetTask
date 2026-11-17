package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/google/uuid"
	"google.golang.org/api/iterator"

	"meettask/backend/internal/domain"
)

var ErrNotFound = errors.New("topilmadi")

type Store struct{ DB *firestore.Client }

type userDoc struct {
	ID           string    `firestore:"id"`
	Name         string    `firestore:"name"`
	Email        string    `firestore:"email"`
	Avatar       *string   `firestore:"avatar,omitempty"`
	Role         *string   `firestore:"role,omitempty"`
	PasswordHash string    `firestore:"passwordHash"`
	CreatedAt    time.Time `firestore:"createdAt"`
}

type memberDoc struct {
	WorkspaceID string            `firestore:"workspaceId"`
	UserID      string            `firestore:"userId"`
	AccessRole  domain.AccessRole `firestore:"accessRole"`
	JoinedAt    time.Time         `firestore:"joinedAt"`
}

type refreshDoc struct {
	ID        string    `firestore:"id"`
	UserID    string    `firestore:"userId"`
	TokenHash []byte    `firestore:"tokenHash"`
	ExpiresAt time.Time `firestore:"expiresAt"`
	RevokedAt time.Time `firestore:"revokedAt,omitempty"`
	CreatedAt time.Time `firestore:"createdAt"`
}

func Open(ctx context.Context, projectID string) (*Store, error) {
	db, err := firestore.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func (s *Store) CreateAccount(ctx context.Context, name, email, passwordHash, workspaceName string) (domain.User, domain.Workspace, error) {
	now := time.Now().UTC()
	userID, workspaceID := uuid.NewString(), uuid.NewString()
	email = strings.ToLower(strings.TrimSpace(email))
	user := userDoc{ID: userID, Name: name, Email: email, PasswordHash: passwordHash, CreatedAt: now}
	workspace := domain.Workspace{ID: workspaceID, Name: workspaceName, OwnerID: userID, CreatedAt: now}
	err := s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		emailRef := s.DB.Collection("userEmails").Doc(email)
		if _, err := tx.Get(emailRef); err == nil {
			return errors.New("bu email allaqachon ro‘yxatdan o‘tgan")
		} else if !isNotFound(err) {
			return err
		}
		if err := tx.Create(emailRef, map[string]any{"userId": userID}); err != nil {
			return err
		}
		if err := tx.Create(s.DB.Collection("users").Doc(userID), user); err != nil {
			return err
		}
		if err := tx.Create(s.DB.Collection("workspaces").Doc(workspaceID), workspace); err != nil {
			return err
		}
		if err := tx.Create(s.memberRef(workspaceID, userID), memberDoc{workspaceID, userID, domain.Owner, now}); err != nil {
			return err
		}
		return tx.Create(s.DB.Collection("settings").Doc(userID), map[string]any{
			"userId": userID, "displayName": name, "email": email, "language": "uz",
			"notifyAiTasks": true, "notifyUpcoming": true, "defaultTaskView": "kanban",
		})
	})
	return toUser(user), workspace, err
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (domain.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	snap, err := s.DB.Collection("userEmails").Doc(email).Get(ctx)
	if err != nil {
		return domain.User{}, "", normalizeNotFound(err)
	}
	userID, err := snap.DataAt("userId")
	if err != nil {
		return domain.User{}, "", err
	}
	var doc userDoc
	userSnap, userErr := s.DB.Collection("users").Doc(fmt.Sprint(userID)).Get(ctx)
	if err := decode(userSnap, userErr, &doc); err != nil {
		return domain.User{}, "", err
	}
	return toUser(doc), doc.PasswordHash, nil
}

func (s *Store) User(ctx context.Context, id string) (domain.User, error) {
	var doc userDoc
	snap, getErr := s.DB.Collection("users").Doc(id).Get(ctx)
	if err := decode(snap, getErr, &doc); err != nil {
		return domain.User{}, err
	}
	return toUser(doc), nil
}

func (s *Store) Membership(ctx context.Context, workspaceID, userID string) (domain.AccessRole, error) {
	var doc memberDoc
	snap, getErr := s.memberRef(workspaceID, userID).Get(ctx)
	if err := decode(snap, getErr, &doc); err != nil {
		return "", err
	}
	return doc.AccessRole, nil
}

func (s *Store) FirstMembership(ctx context.Context, userID string) (string, domain.AccessRole, error) {
	iter := s.DB.Collection("workspaceMembers").Where("userId", "==", userID).Limit(1).Documents(ctx)
	defer iter.Stop()
	snap, err := iter.Next()
	if err != nil {
		return "", "", normalizeNotFound(err)
	}
	var doc memberDoc
	if err := snap.DataTo(&doc); err != nil {
		return "", "", err
	}
	return doc.WorkspaceID, doc.AccessRole, nil
}

func (s *Store) SaveRefresh(ctx context.Context, id, userID string, hash []byte, expires time.Time) error {
	_, err := s.DB.Collection("refreshTokens").Doc(id).Create(ctx, refreshDoc{
		ID: id, UserID: userID, TokenHash: hash, ExpiresAt: expires, CreatedAt: time.Now().UTC(),
	})
	return err
}

func (s *Store) ConsumeRefresh(ctx context.Context, id, userID string, hash []byte) error {
	ref := s.DB.Collection("refreshTokens").Doc(id)
	return s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		if err != nil {
			return normalizeNotFound(err)
		}
		var doc refreshDoc
		if err := snap.DataTo(&doc); err != nil {
			return err
		}
		if doc.UserID != userID || !bytes.Equal(doc.TokenHash, hash) || !doc.RevokedAt.IsZero() || time.Now().After(doc.ExpiresAt) {
			return errors.New("refresh token yaroqsiz")
		}
		return tx.Update(ref, []firestore.Update{{Path: "revokedAt", Value: time.Now().UTC()}})
	})
}

func (s *Store) RevokeRefresh(ctx context.Context, id string) error {
	_, err := s.DB.Collection("refreshTokens").Doc(id).Update(ctx, []firestore.Update{{Path: "revokedAt", Value: time.Now().UTC()}})
	if isNotFound(err) {
		return nil
	}
	return err
}

func (s *Store) Members(ctx context.Context, workspaceID string) ([]domain.WorkspaceMember, error) {
	iter := s.DB.Collection("workspaceMembers").Where("workspaceId", "==", workspaceID).Documents(ctx)
	defer iter.Stop()
	var members []domain.WorkspaceMember
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var membership memberDoc
		if err := snap.DataTo(&membership); err != nil {
			return nil, err
		}
		user, err := s.User(ctx, membership.UserID)
		if err != nil {
			return nil, err
		}
		members = append(members, domain.WorkspaceMember{User: user, AccessRole: membership.AccessRole, JoinedAt: membership.JoinedAt})
	}
	return members, nil
}

// AddMember attaches a person to a workspace. An email that already has an
// account is linked to that user; otherwise the person is created as an invited
// member with an unusable password, so they can be assigned work right away and
// claim the account later. A member without an email is kept for assignment only.
func (s *Store) AddMember(ctx context.Context, workspaceID, email, name string, jobRole *string, role domain.AccessRole, unusableHash string) (domain.WorkspaceMember, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	now := time.Now().UTC()
	userID := uuid.NewString()
	var user userDoc
	err := s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		created := true
		if email != "" {
			emailRef := s.DB.Collection("userEmails").Doc(email)
			snap, err := tx.Get(emailRef)
			switch {
			case err == nil:
				value, valueErr := snap.DataAt("userId")
				if valueErr != nil {
					return valueErr
				}
				userID, created = fmt.Sprint(value), false
			case isNotFound(err):
				if err := tx.Create(emailRef, map[string]any{"userId": userID}); err != nil {
					return err
				}
			default:
				return err
			}
		}
		memberRef := s.memberRef(workspaceID, userID)
		if !created {
			if _, err := tx.Get(memberRef); err == nil {
				return errors.New("bu odam allaqachon jamoada")
			} else if !isNotFound(err) {
				return err
			}
			userSnap, err := tx.Get(s.DB.Collection("users").Doc(userID))
			if err != nil {
				return normalizeNotFound(err)
			}
			if err := userSnap.DataTo(&user); err != nil {
				return err
			}
			if jobRole != nil {
				user.Role = jobRole
				if err := tx.Update(userSnap.Ref, []firestore.Update{{Path: "role", Value: *jobRole}}); err != nil {
					return err
				}
			}
		} else {
			user = userDoc{ID: userID, Name: name, Email: email, Role: jobRole, PasswordHash: unusableHash, CreatedAt: now}
			if err := tx.Create(s.DB.Collection("users").Doc(userID), user); err != nil {
				return err
			}
		}
		return tx.Create(memberRef, memberDoc{WorkspaceID: workspaceID, UserID: userID, AccessRole: role, JoinedAt: now})
	})
	if err != nil {
		return domain.WorkspaceMember{}, err
	}
	return domain.WorkspaceMember{User: toUser(user), AccessRole: role, JoinedAt: now}, nil
}

// ImportUser upserts a legacy team member and attaches them to a workspace.
// Imported users receive a random, unknown password hash and must use a future
// password-reset flow before signing in directly.
func (s *Store) ImportUser(ctx context.Context, workspaceID, name, email string, avatar, jobRole *string, passwordHash string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	userID := uuid.NewString()
	now := time.Now().UTC()
	err := s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		emailRef := s.DB.Collection("userEmails").Doc(email)
		snap, err := tx.Get(emailRef)
		if err == nil {
			value, valueErr := snap.DataAt("userId")
			if valueErr != nil {
				return valueErr
			}
			userID = fmt.Sprint(value)
		} else if isNotFound(err) {
			if err := tx.Create(emailRef, map[string]any{"userId": userID}); err != nil {
				return err
			}
			if err := tx.Create(s.DB.Collection("users").Doc(userID), userDoc{ID: userID, Name: name, Email: email, Avatar: avatar, Role: jobRole, PasswordHash: passwordHash, CreatedAt: now}); err != nil {
				return err
			}
		} else {
			return err
		}
		return tx.Set(s.memberRef(workspaceID, userID), memberDoc{WorkspaceID: workspaceID, UserID: userID, AccessRole: domain.Member, JoinedAt: now}, firestore.MergeAll)
	})
	return userID, err
}

func (s *Store) UpdateMember(ctx context.Context, workspaceID, userID string, accessRole *domain.AccessRole, jobRole, name *string) error {
	return s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		memberRef := s.memberRef(workspaceID, userID)
		snap, err := tx.Get(memberRef)
		if err != nil {
			return normalizeNotFound(err)
		}
		var current memberDoc
		if err := snap.DataTo(&current); err != nil {
			return err
		}
		if accessRole != nil && current.AccessRole == domain.Owner && *accessRole != domain.Owner {
			owners, err := tx.Documents(s.DB.Collection("workspaceMembers").Where("workspaceId", "==", workspaceID).Where("accessRole", "==", string(domain.Owner))).GetAll()
			if err != nil {
				return err
			}
			if len(owners) <= 1 {
				return errors.New("oxirgi owner darajasini tushirib bo‘lmaydi")
			}
		}
		if accessRole != nil {
			if err := tx.Update(memberRef, []firestore.Update{{Path: "accessRole", Value: *accessRole}}); err != nil {
				return err
			}
		}
		var profile []firestore.Update
		if jobRole != nil {
			profile = append(profile, firestore.Update{Path: "role", Value: *jobRole})
		}
		if name != nil {
			profile = append(profile, firestore.Update{Path: "name", Value: *name})
		}
		if len(profile) > 0 {
			return tx.Update(s.DB.Collection("users").Doc(userID), profile)
		}
		return nil
	})
}

func (s *Store) RemoveMember(ctx context.Context, workspaceID, userID string) error {
	return s.DB.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		ref := s.memberRef(workspaceID, userID)
		snap, err := tx.Get(ref)
		if err != nil {
			return normalizeNotFound(err)
		}
		var doc memberDoc
		if err := snap.DataTo(&doc); err != nil {
			return err
		}
		if doc.AccessRole == domain.Owner {
			owners, err := tx.Documents(s.DB.Collection("workspaceMembers").Where("workspaceId", "==", workspaceID).Where("accessRole", "==", string(domain.Owner))).GetAll()
			if err != nil {
				return err
			}
			if len(owners) <= 1 {
				return errors.New("oxirgi ownerni olib tashlab bo‘lmaydi")
			}
		}
		return tx.Delete(ref)
	})
}

type meetingDoc struct {
	AnalysisMode   string    `firestore:"analysisMode,omitempty"`
	ID             string    `firestore:"id"`
	WorkspaceID    string    `firestore:"workspaceId"`
	Title          string    `firestore:"title"`
	Date           time.Time `firestore:"date"`
	Duration       string    `firestore:"duration"`
	Status         string    `firestore:"status"`
	Summary        *string   `firestore:"summary,omitempty"`
	KeyPoints      []string  `firestore:"keyPoints"`
	Decisions      []string  `firestore:"decisions"`
	CreatedBy      string    `firestore:"createdBy"`
	CreatedAt      time.Time `firestore:"createdAt"`
	ParticipantIDs []string  `firestore:"participantIds"`
}

type taskDoc struct {
	ID             string    `firestore:"id"`
	WorkspaceID    string    `firestore:"workspaceId"`
	MeetingID      *string   `firestore:"meetingId,omitempty"`
	Title          string    `firestore:"title"`
	Description    *string   `firestore:"description,omitempty"`
	AssigneeID     *string   `firestore:"assigneeId,omitempty"`
	AssigneeIDs    []string  `firestore:"assigneeIds"`
	AssigneeSource *string   `firestore:"assigneeSource,omitempty"`
	AssignmentRole *string   `firestore:"assignmentRole,omitempty"`
	Deadline       string    `firestore:"deadline"`
	Priority       string    `firestore:"priority"`
	Status         string    `firestore:"status"`
	IsAIGenerated  bool      `firestore:"isAiGenerated"`
	IsApproved     bool      `firestore:"isApproved"`
	OrderIndex     float64   `firestore:"orderIndex"`
	CreatedBy      string    `firestore:"createdBy"`
	UpdatedAt      time.Time `firestore:"updatedAt"`
}

func (s *Store) CreateMeeting(ctx context.Context, meeting domain.Meeting, participantIDs []string) (domain.Meeting, error) {
	meeting.ID, meeting.CreatedAt = uuid.NewString(), time.Now().UTC()
	doc := meetingDoc{meeting.AnalysisMode, meeting.ID, meeting.WorkspaceID, meeting.Title, meeting.Date, meeting.Duration,
		meeting.Status, meeting.Summary, nonNil(meeting.KeyPoints), nonNil(meeting.Decisions), meeting.CreatedBy, meeting.CreatedAt, uniqueStrings(participantIDs)}
	if _, err := s.DB.Collection("meetings").Doc(meeting.ID).Create(ctx, doc); err != nil {
		return domain.Meeting{}, err
	}
	meeting.Participants, _ = s.users(ctx, doc.ParticipantIDs)
	return meeting, nil
}

func (s *Store) Meetings(ctx context.Context, workspaceID, status, search string, limit int) ([]domain.Meeting, error) {
	query := s.DB.Collection("meetings").Where("workspaceId", "==", workspaceID).OrderBy("date", firestore.Desc).Limit(limit * 3)
	iter := query.Documents(ctx)
	defer iter.Stop()
	meetings := make([]domain.Meeting, 0, limit)
	for len(meetings) < limit {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var doc meetingDoc
		if err := snap.DataTo(&doc); err != nil {
			return nil, err
		}
		if status != "" && doc.Status != status || search != "" && !strings.Contains(strings.ToLower(doc.Title), strings.ToLower(search)) {
			continue
		}
		meeting, err := s.meetingFromDoc(ctx, doc, false)
		if err != nil {
			return nil, err
		}
		meetings = append(meetings, meeting)
	}
	return meetings, nil
}

func (s *Store) Meeting(ctx context.Context, workspaceID, id string, expanded bool) (domain.Meeting, error) {
	var doc meetingDoc
	snap, getErr := s.DB.Collection("meetings").Doc(id).Get(ctx)
	if err := decode(snap, getErr, &doc); err != nil {
		return domain.Meeting{}, err
	}
	if doc.WorkspaceID != workspaceID {
		return domain.Meeting{}, ErrNotFound
	}
	return s.meetingFromDoc(ctx, doc, expanded)
}

func (s *Store) meetingFromDoc(ctx context.Context, doc meetingDoc, expanded bool) (domain.Meeting, error) {
	meeting := domain.Meeting{AnalysisMode: doc.AnalysisMode, ID: doc.ID, WorkspaceID: doc.WorkspaceID, Title: doc.Title, Date: doc.Date,
		Duration: doc.Duration, Status: doc.Status, Summary: doc.Summary, KeyPoints: nonNil(doc.KeyPoints),
		Decisions: nonNil(doc.Decisions), CreatedBy: doc.CreatedBy, CreatedAt: doc.CreatedAt}
	var err error
	meeting.Participants, err = s.users(ctx, doc.ParticipantIDs)
	if err != nil {
		return domain.Meeting{}, err
	}
	if expanded {
		meeting.Transcript, err = s.Transcript(ctx, doc.WorkspaceID, doc.ID)
		if err != nil {
			return domain.Meeting{}, err
		}
		meeting.Tasks, err = s.Tasks(ctx, doc.WorkspaceID, map[string]string{"meeting": doc.ID}, 200)
	}
	return meeting, err
}

func (s *Store) UpdateMeeting(ctx context.Context, workspaceID, id string, updates map[string]any) (domain.Meeting, error) {
	if _, err := s.Meeting(ctx, workspaceID, id, false); err != nil {
		return domain.Meeting{}, err
	}
	allowed := map[string]bool{"analysisMode": true, "title": true, "date": true, "duration": true, "status": true, "summary": true, "keyPoints": true, "decisions": true, "participantIds": true}
	values := make([]firestore.Update, 0, len(updates))
	for key, value := range updates {
		if allowed[key] {
			values = append(values, firestore.Update{Path: key, Value: value})
		}
	}
	if len(values) > 0 {
		if _, err := s.DB.Collection("meetings").Doc(id).Update(ctx, values); err != nil {
			return domain.Meeting{}, err
		}
	}
	return s.Meeting(ctx, workspaceID, id, false)
}

func (s *Store) DeleteMeeting(ctx context.Context, workspaceID, id string) error {
	if _, err := s.Meeting(ctx, workspaceID, id, false); err != nil {
		return err
	}
	refs := []*firestore.DocumentRef{s.DB.Collection("meetings").Doc(id)}
	for _, query := range []firestore.Query{
		s.DB.Collection("transcriptLines").Where("meetingId", "==", id),
		s.DB.Collection("tasks").Where("workspaceId", "==", workspaceID).Where("meetingId", "==", id),
	} {
		snaps, err := query.Documents(ctx).GetAll()
		if err != nil {
			return err
		}
		for _, snap := range snaps {
			refs = append(refs, snap.Ref)
		}
	}
	return s.bulkDelete(ctx, refs)
}

func (s *Store) ReplaceTranscript(ctx context.Context, workspaceID, meetingID string, lines []domain.TranscriptLine) error {
	if _, err := s.Meeting(ctx, workspaceID, meetingID, false); err != nil {
		return err
	}
	var refs []*firestore.DocumentRef
	existing := s.DB.Collection("transcriptLines").Where("meetingId", "==", meetingID).Documents(ctx)
	for {
		snap, err := existing.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}
		refs = append(refs, snap.Ref)
	}
	if err := s.bulkDelete(ctx, refs); err != nil {
		return err
	}
	bulk := s.DB.BulkWriter(ctx)
	jobs := make([]*firestore.BulkWriterJob, 0, len(lines))
	for index, line := range lines {
		if line.ID == "" {
			line.ID = uuid.NewString()
		}
		line.MeetingID, line.OrderIndex = meetingID, index
		job, err := bulk.Set(s.DB.Collection("transcriptLines").Doc(line.ID), line)
		if err != nil {
			bulk.End()
			return err
		}
		jobs = append(jobs, job)
	}
	bulk.End()
	return bulkResults(jobs)
}

func (s *Store) Transcript(ctx context.Context, workspaceID, meetingID string) ([]domain.TranscriptLine, error) {
	if _, err := s.Meeting(ctx, workspaceID, meetingID, false); err != nil {
		return nil, err
	}
	iter := s.DB.Collection("transcriptLines").Where("meetingId", "==", meetingID).OrderBy("orderIndex", firestore.Asc).Documents(ctx)
	defer iter.Stop()
	var lines []domain.TranscriptLine
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var line domain.TranscriptLine
		if err := snap.DataTo(&line); err != nil {
			return nil, err
		}
		lines = append(lines, line)
	}
	return lines, nil
}

func (s *Store) CreateTask(ctx context.Context, task domain.Task) (domain.Task, error) {
	task.ID, task.UpdatedAt = uuid.NewString(), time.Now().UTC()
	if task.AssigneeID == nil && len(task.AssigneeIDs) > 0 {
		task.AssigneeID = &task.AssigneeIDs[0]
	}
	doc := taskFromDomain(task)
	if _, err := s.DB.Collection("tasks").Doc(task.ID).Create(ctx, doc); err != nil {
		return domain.Task{}, err
	}
	return task, nil
}

func (s *Store) Tasks(ctx context.Context, workspaceID string, filters map[string]string, limit int) ([]domain.Task, error) {
	iter := s.DB.Collection("tasks").Where("workspaceId", "==", workspaceID).OrderBy("updatedAt", firestore.Desc).Limit(limit * 4).Documents(ctx)
	defer iter.Stop()
	tasks := make([]domain.Task, 0, limit)
	for len(tasks) < limit {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var doc taskDoc
		if err := snap.DataTo(&doc); err != nil {
			return nil, err
		}
		if filters["status"] != "" && doc.Status != filters["status"] || filters["priority"] != "" && doc.Priority != filters["priority"] ||
			filters["meeting"] != "" && (doc.MeetingID == nil || *doc.MeetingID != filters["meeting"]) ||
			filters["assignee"] != "" && !contains(doc.AssigneeIDs, filters["assignee"]) ||
			filters["q"] != "" && !strings.Contains(strings.ToLower(doc.Title+" "+value(doc.Description)), strings.ToLower(filters["q"])) {
			continue
		}
		tasks = append(tasks, taskToDomain(doc))
	}
	return tasks, nil
}

func (s *Store) Task(ctx context.Context, workspaceID, id string) (domain.Task, error) {
	var doc taskDoc
	snap, getErr := s.DB.Collection("tasks").Doc(id).Get(ctx)
	if err := decode(snap, getErr, &doc); err != nil {
		return domain.Task{}, err
	}
	if doc.WorkspaceID != workspaceID {
		return domain.Task{}, ErrNotFound
	}
	return taskToDomain(doc), nil
}

func (s *Store) UpdateTask(ctx context.Context, workspaceID, id string, updates map[string]any) (domain.Task, error) {
	if _, err := s.Task(ctx, workspaceID, id); err != nil {
		return domain.Task{}, err
	}
	allowed := map[string]bool{"title": true, "description": true, "assigneeId": true, "assigneeIds": true, "assigneeSource": true,
		"assignmentRole": true, "deadline": true, "priority": true, "status": true, "isApproved": true, "orderIndex": true}
	values := []firestore.Update{{Path: "updatedAt", Value: time.Now().UTC()}}
	for key, val := range updates {
		if allowed[key] {
			values = append(values, firestore.Update{Path: key, Value: val})
		}
	}
	if _, err := s.DB.Collection("tasks").Doc(id).Update(ctx, values); err != nil {
		return domain.Task{}, err
	}
	return s.Task(ctx, workspaceID, id)
}

func (s *Store) DeleteTask(ctx context.Context, workspaceID, id string) error {
	if _, err := s.Task(ctx, workspaceID, id); err != nil {
		return err
	}
	_, err := s.DB.Collection("tasks").Doc(id).Delete(ctx)
	return err
}

func (s *Store) ReplaceAITasks(ctx context.Context, workspaceID, meetingID, creatorID string, tasks []domain.Task) ([]domain.Task, error) {
	iter := s.DB.Collection("tasks").Where("workspaceId", "==", workspaceID).Where("meetingId", "==", meetingID).Where("isAiGenerated", "==", true).Documents(ctx)
	var oldRefs []*firestore.DocumentRef
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		oldRefs = append(oldRefs, snap.Ref)
	}
	if err := s.bulkDelete(ctx, oldRefs); err != nil {
		return nil, err
	}
	bulk := s.DB.BulkWriter(ctx)
	jobs := make([]*firestore.BulkWriterJob, 0, len(tasks))
	created := make([]domain.Task, 0, len(tasks))
	for _, task := range tasks {
		task.ID, task.WorkspaceID, task.MeetingID, task.CreatedBy, task.UpdatedAt = uuid.NewString(), workspaceID, &meetingID, creatorID, time.Now().UTC()
		task.IsAIGenerated = true
		if task.AssigneeID == nil && len(task.AssigneeIDs) > 0 {
			task.AssigneeID = &task.AssigneeIDs[0]
		}
		job, err := bulk.Set(s.DB.Collection("tasks").Doc(task.ID), taskFromDomain(task))
		if err != nil {
			bulk.End()
			return nil, err
		}
		jobs = append(jobs, job)
		created = append(created, task)
	}
	bulk.End()
	return created, bulkResults(jobs)
}

func (s *Store) Settings(ctx context.Context, userID string) (map[string]any, error) {
	snap, err := s.DB.Collection("settings").Doc(userID).Get(ctx)
	if err != nil {
		return nil, normalizeNotFound(err)
	}
	return snap.Data(), nil
}

func (s *Store) UpdateSettings(ctx context.Context, userID string, values map[string]any) (map[string]any, error) {
	allowed := map[string]bool{"displayName": true, "email": true, "language": true, "notifyAiTasks": true, "notifyUpcoming": true, "defaultTaskView": true}
	updates := []firestore.Update{}
	for key, val := range values {
		if allowed[key] {
			updates = append(updates, firestore.Update{Path: key, Value: val})
		}
	}
	if len(updates) > 0 {
		if _, err := s.DB.Collection("settings").Doc(userID).Update(ctx, updates); err != nil {
			return nil, err
		}
	}
	return s.Settings(ctx, userID)
}

func (s *Store) Notifications(ctx context.Context, userID string) ([]map[string]any, error) {
	iter := s.DB.Collection("notifications").Where("userId", "==", userID).OrderBy("createdAt", firestore.Desc).Limit(100).Documents(ctx)
	defer iter.Stop()
	var result []map[string]any
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		item := snap.Data()
		item["id"] = snap.Ref.ID
		result = append(result, item)
	}
	return result, nil
}

func (s *Store) ReadNotifications(ctx context.Context, userID string, ids []string) error {
	batch := s.DB.Batch()
	for _, id := range uniqueStrings(ids) {
		ref := s.DB.Collection("notifications").Doc(id)
		snap, err := ref.Get(ctx)
		if err != nil {
			continue
		}
		if snap.Data()["userId"] == userID {
			batch.Update(ref, []firestore.Update{{Path: "readAt", Value: time.Now().UTC()}})
		}
	}
	_, err := batch.Commit(ctx)
	return err
}

func taskFromDomain(task domain.Task) taskDoc {
	return taskDoc{task.ID, task.WorkspaceID, task.MeetingID, task.Title, task.Description, task.AssigneeID,
		nonNil(task.AssigneeIDs), task.AssigneeSource, task.AssignmentRole, task.Deadline, task.Priority, task.Status,
		task.IsAIGenerated, task.IsApproved, task.OrderIndex, task.CreatedBy, task.UpdatedAt}
}

func taskToDomain(doc taskDoc) domain.Task {
	return domain.Task{ID: doc.ID, WorkspaceID: doc.WorkspaceID, MeetingID: doc.MeetingID, Title: doc.Title,
		Description: doc.Description, AssigneeID: doc.AssigneeID, AssigneeIDs: nonNil(doc.AssigneeIDs),
		AssigneeSource: doc.AssigneeSource, AssignmentRole: doc.AssignmentRole, Deadline: doc.Deadline,
		Priority: doc.Priority, Status: doc.Status, IsAIGenerated: doc.IsAIGenerated, IsApproved: doc.IsApproved,
		OrderIndex: doc.OrderIndex, CreatedBy: doc.CreatedBy, UpdatedAt: doc.UpdatedAt}
}

func (s *Store) users(ctx context.Context, ids []string) ([]domain.User, error) {
	users := make([]domain.User, 0, len(ids))
	for _, id := range uniqueStrings(ids) {
		user, err := s.User(ctx, id)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

func uniqueStrings(values []string) []string {
	seen, out := map[string]struct{}{}, make([]string, 0, len(values))
	for _, item := range values {
		if _, ok := seen[item]; !ok && item != "" {
			seen[item] = struct{}{}
			out = append(out, item)
		}
	}
	return out
}

func nonNil[T any](values []T) []T {
	if values == nil {
		return []T{}
	}
	return values
}

func contains(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func value(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (s *Store) memberRef(workspaceID, userID string) *firestore.DocumentRef {
	return s.DB.Collection("workspaceMembers").Doc(workspaceID + "_" + userID)
}

func (s *Store) bulkDelete(ctx context.Context, refs []*firestore.DocumentRef) error {
	if len(refs) == 0 {
		return nil
	}
	bulk := s.DB.BulkWriter(ctx)
	jobs := make([]*firestore.BulkWriterJob, 0, len(refs))
	for _, ref := range refs {
		job, err := bulk.Delete(ref)
		if err != nil {
			bulk.End()
			return err
		}
		jobs = append(jobs, job)
	}
	bulk.End()
	return bulkResults(jobs)
}

func bulkResults(jobs []*firestore.BulkWriterJob) error {
	for _, job := range jobs {
		if _, err := job.Results(); err != nil {
			return err
		}
	}
	return nil
}

func toUser(doc userDoc) domain.User {
	return domain.User{ID: doc.ID, Name: doc.Name, Email: doc.Email, Avatar: doc.Avatar, Role: doc.Role, CreatedAt: doc.CreatedAt}
}

func decode(snapshot *firestore.DocumentSnapshot, err error, target any) error {
	if err != nil {
		return normalizeNotFound(err)
	}
	return snapshot.DataTo(target)
}

func isNotFound(err error) bool { return err != nil && strings.Contains(err.Error(), "NotFound") }

func normalizeNotFound(err error) error {
	if err == iterator.Done || isNotFound(err) {
		return ErrNotFound
	}
	return err
}
