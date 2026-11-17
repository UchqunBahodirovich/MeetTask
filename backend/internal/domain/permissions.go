package domain

type Action string

const (
	DeleteWorkspace Action = "delete_workspace"
	ManageMembers   Action = "manage_members"
	EditJobRoles    Action = "edit_job_roles"
	CreateMeeting   Action = "create_meeting"
	AnalyzeMeeting  Action = "analyze_meeting"
)

func Allowed(role AccessRole, action Action) bool {
	switch action {
	case DeleteWorkspace:
		return role == Owner
	case ManageMembers, EditJobRoles:
		return role == Owner || role == Admin
	case CreateMeeting, AnalyzeMeeting:
		return role == Owner || role == Admin || role == Member
	default:
		return false
	}
}

func CanEditTask(identity Identity, task Task) bool {
	if identity.AccessRole == Owner || identity.AccessRole == Admin {
		return true
	}
	if identity.AccessRole != Member {
		return false
	}
	if task.CreatedBy == identity.UserID {
		return true
	}
	for _, id := range task.AssigneeIDs {
		if id == identity.UserID {
			return true
		}
	}
	return task.AssigneeID != nil && *task.AssigneeID == identity.UserID
}

func CanDeleteTask(identity Identity, task Task) bool {
	return identity.AccessRole == Owner || identity.AccessRole == Admin ||
		(identity.AccessRole == Member && task.CreatedBy == identity.UserID)
}

func CanChangeTaskStatus(identity Identity, task Task) bool {
	if identity.AccessRole == Owner || identity.AccessRole == Admin {
		return true
	}
	if identity.AccessRole != Member {
		return false
	}
	for _, id := range task.AssigneeIDs {
		if id == identity.UserID {
			return true
		}
	}
	return task.AssigneeID != nil && *task.AssigneeID == identity.UserID
}
