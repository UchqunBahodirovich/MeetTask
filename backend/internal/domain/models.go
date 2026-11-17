package domain

import "time"

type AccessRole string

const (
	Owner  AccessRole = "owner"
	Admin  AccessRole = "admin"
	Member AccessRole = "member"
	Guest  AccessRole = "guest"
)

type User struct {
	ID        string    `json:"id" firestore:"id"`
	Name      string    `json:"name" firestore:"name"`
	Email     string    `json:"email" firestore:"email"`
	Avatar    *string   `json:"avatar,omitempty" firestore:"avatar,omitempty"`
	Role      *string   `json:"role,omitempty" firestore:"role,omitempty"`
	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
}

type Identity struct {
	UserID      string
	WorkspaceID string
	AccessRole  AccessRole
}

type Workspace struct {
	ID        string    `json:"id" firestore:"id"`
	Name      string    `json:"name" firestore:"name"`
	OwnerID   string    `json:"ownerId" firestore:"ownerId"`
	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
}

type WorkspaceMember struct {
	User
	AccessRole AccessRole `json:"accessRole" firestore:"accessRole"`
	JoinedAt   time.Time  `json:"joinedAt" firestore:"joinedAt"`
}

type Meeting struct {
	AnalysisMode string           `json:"analysisMode,omitempty" firestore:"analysisMode,omitempty"`
	ID           string           `json:"id" firestore:"id"`
	WorkspaceID  string           `json:"workspaceId" firestore:"workspaceId"`
	Title        string           `json:"title" firestore:"title"`
	Date         time.Time        `json:"date" firestore:"date"`
	Duration     string           `json:"duration" firestore:"duration"`
	Status       string           `json:"status" firestore:"status"`
	Summary      *string          `json:"summary,omitempty" firestore:"summary,omitempty"`
	KeyPoints    []string         `json:"keyPoints" firestore:"keyPoints"`
	Decisions    []string         `json:"decisions" firestore:"decisions"`
	CreatedBy    string           `json:"createdBy" firestore:"createdBy"`
	CreatedAt    time.Time        `json:"createdAt" firestore:"createdAt"`
	Participants []User           `json:"participants,omitempty"`
	Transcript   []TranscriptLine `json:"transcript,omitempty"`
	Tasks        []Task           `json:"tasks,omitempty"`
}

type TranscriptLine struct {
	ID         string `json:"id" firestore:"id"`
	MeetingID  string `json:"meetingId" firestore:"meetingId"`
	Speaker    string `json:"speaker" firestore:"speaker"`
	Text       string `json:"text" firestore:"text"`
	Timestamp  string `json:"timestamp" firestore:"timestamp"`
	OrderIndex int    `json:"orderIndex" firestore:"orderIndex"`
}

type Task struct {
	ID             string    `json:"id"`
	WorkspaceID    string    `json:"workspaceId"`
	MeetingID      *string   `json:"meetingId,omitempty"`
	Title          string    `json:"title"`
	Description    *string   `json:"description,omitempty"`
	AssigneeID     *string   `json:"assigneeId,omitempty"`
	AssigneeIDs    []string  `json:"assigneeIds"`
	AssigneeSource *string   `json:"assigneeSource,omitempty"`
	AssignmentRole *string   `json:"assignmentRole,omitempty"`
	Deadline       string    `json:"deadline"`
	Priority       string    `json:"priority"`
	Status         string    `json:"status"`
	IsAIGenerated  bool      `json:"isAiGenerated"`
	IsApproved     bool      `json:"isApproved"`
	OrderIndex     float64   `json:"orderIndex"`
	CreatedBy      string    `json:"createdBy"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
