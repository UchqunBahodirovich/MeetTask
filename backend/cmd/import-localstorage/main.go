package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"

	"meettask/backend/internal/auth"
	"meettask/backend/internal/config"
	"meettask/backend/internal/domain"
	"meettask/backend/internal/store"
)

type legacyUser struct {
	ID, Name, Email string
	Avatar, Role    *string
}

type legacyLine struct{ ID, Speaker, Text, Timestamp string }

type legacyTask struct {
	ID, Title, Deadline, Priority, Status, MeetingID string
	Description, AssigneeSource, AssignmentRole      *string
	AssigneeID                                       string
	AssigneeIDs                                      []string
	IsAIGenerated, IsApproved                        bool
}

type legacyMeeting struct {
	ID, Title, Date, Duration, Status string
	Summary                           *string
	KeyPoints, Decisions              []string
	Participants                      []legacyUser
	Transcript                        []legacyLine
	Tasks                             []legacyTask
}

type exportFile struct {
	Meetings []legacyMeeting `json:"meetings"`
	Tasks    []legacyTask    `json:"tasks"`
	Team     []legacyUser    `json:"team"`
	Settings map[string]any  `json:"settings"`
}

func main() {
	file := flag.String("file", "", "localStorage JSON export path")
	workspaceID := flag.String("workspace", "", "target workspace UUID")
	ownerID := flag.String("owner", "", "existing owner user UUID")
	flag.Parse()
	if *file == "" || uuid.Validate(*workspaceID) != nil || uuid.Validate(*ownerID) != nil {
		log.Fatal("-file, -workspace va -owner (UUID) majburiy")
	}
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	data, err := os.ReadFile(*file)
	if err != nil {
		log.Fatal(err)
	}
	var input exportFile
	if err := json.Unmarshal(data, &input); err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	db, err := store.Open(ctx, cfg.GoogleCloudProject)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Membership(ctx, *workspaceID, *ownerID); err != nil {
		log.Fatal("owner target workspace a’zosi emas")
	}
	owner, err := db.User(ctx, *ownerID)
	if err != nil {
		log.Fatal(err)
	}
	userIDs := map[string]string{}
	for _, person := range input.Team {
		if strings.EqualFold(person.Email, owner.Email) {
			userIDs[person.ID] = owner.ID
			continue
		}
		randomHash, _ := auth.HashPassword(uuid.NewString())
		id, err := db.ImportUser(ctx, *workspaceID, person.Name, person.Email, person.Avatar, person.Role, randomHash)
		if err != nil {
			log.Fatal(err)
		}
		userIDs[person.ID] = id
	}
	meetingIDs := map[string]string{}
	allTasks := append([]legacyTask(nil), input.Tasks...)
	for _, old := range input.Meetings {
		date, err := time.Parse(time.RFC3339, old.Date)
		if err != nil {
			log.Fatalf("meeting %s date: %v", old.ID, err)
		}
		participants := make([]string, 0, len(old.Participants))
		for _, person := range old.Participants {
			if id := userIDs[person.ID]; id != "" {
				participants = append(participants, id)
			}
		}
		meeting, err := db.CreateMeeting(ctx, domain.Meeting{WorkspaceID: *workspaceID, Title: old.Title, Date: date,
			Duration: old.Duration, Status: old.Status, Summary: old.Summary, KeyPoints: old.KeyPoints,
			Decisions: old.Decisions, CreatedBy: *ownerID}, participants)
		if err != nil {
			log.Fatal(err)
		}
		meetingIDs[old.ID] = meeting.ID
		lines := make([]domain.TranscriptLine, 0, len(old.Transcript))
		for index, line := range old.Transcript {
			lines = append(lines, domain.TranscriptLine{Speaker: line.Speaker, Text: line.Text, Timestamp: line.Timestamp, OrderIndex: index})
		}
		if len(lines) > 0 {
			if err := db.ReplaceTranscript(ctx, *workspaceID, meeting.ID, lines); err != nil {
				log.Fatal(err)
			}
		}
		allTasks = append(allTasks, old.Tasks...)
	}
	seenTasks := map[string]bool{}
	for index, old := range allTasks {
		if old.ID != "" && seenTasks[old.ID] {
			continue
		}
		seenTasks[old.ID] = true
		assignees := make([]string, 0, len(old.AssigneeIDs))
		for _, oldID := range append(old.AssigneeIDs, old.AssigneeID) {
			if id := userIDs[oldID]; id != "" && !contains(assignees, id) {
				assignees = append(assignees, id)
			}
		}
		var meetingID *string
		if id := meetingIDs[old.MeetingID]; id != "" {
			meetingID = &id
		}
		_, err := db.CreateTask(ctx, domain.Task{WorkspaceID: *workspaceID, MeetingID: meetingID, Title: old.Title,
			Description: old.Description, AssigneeIDs: assignees, AssigneeSource: old.AssigneeSource,
			AssignmentRole: old.AssignmentRole, Deadline: old.Deadline, Priority: old.Priority, Status: old.Status,
			IsAIGenerated: old.IsAIGenerated, IsApproved: old.IsApproved, OrderIndex: float64(index), CreatedBy: *ownerID})
		if err != nil {
			log.Fatal(err)
		}
	}
	if len(input.Settings) > 0 {
		if _, err := db.UpdateSettings(ctx, *ownerID, input.Settings); err != nil {
			log.Fatal(err)
		}
	}
	fmt.Printf("Imported %d team members, %d meetings and %d tasks.\n", len(input.Team), len(input.Meetings), len(seenTasks))
}

func contains(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}
