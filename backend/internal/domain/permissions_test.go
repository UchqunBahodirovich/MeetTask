package domain

import "testing"

func TestPermissionMatrix(t *testing.T) {
	if !Allowed(Owner, DeleteWorkspace) || Allowed(Admin, DeleteWorkspace) {
		t.Fatal("workspace deletion permission is wrong")
	}
	if !Allowed(Member, CreateMeeting) || Allowed(Guest, CreateMeeting) {
		t.Fatal("meeting creation permission is wrong")
	}
}

func TestMemberCannotDeleteSomeoneElsesTask(t *testing.T) {
	identity := Identity{UserID: "member", AccessRole: Member}
	task := Task{CreatedBy: "other", AssigneeIDs: []string{"member"}}
	if CanDeleteTask(identity, task) {
		t.Fatal("member deleted another user's task")
	}
	if !CanChangeTaskStatus(identity, task) {
		t.Fatal("assignee could not change task status")
	}
}
