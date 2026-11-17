package analysis

import (
	"testing"
	"time"
)

func TestChunkTranscriptKeepsLines(t *testing.T) {
	chunks := ChunkTranscript("one\ntwo\nthree", 7)
	if len(chunks) != 2 || chunks[0] != "one\ntwo" || chunks[1] != "three" {
		t.Fatalf("unexpected chunks: %#v", chunks)
	}
}

func TestMergeDeduplicatesSignificantWords(t *testing.T) {
	merged := Merge([]Result{
		{Tasks: []Task{{Title: "Send budget report", Priority: "medium", AssignmentBasis: "unassigned"}}},
		{Tasks: []Task{{Title: "Budget report due Friday", Priority: "high", AssignmentBasis: "unassigned"}}},
	})
	if len(merged.Tasks) != 1 || merged.Tasks[0].Priority != "high" {
		t.Fatalf("unexpected merge: %#v", merged.Tasks)
	}
}

func TestNamedAssigneeBeatsRole(t *testing.T) {
	role := "Designer"
	merged := Merge([]Result{
		{Tasks: []Task{{Title: "Create mockup", AssigneeIDs: []string{"role-user"}, AssignmentBasis: "role", SuggestedRole: &role}}},
		{Tasks: []Task{{Title: "Create the mockup", AssigneeIDs: []string{"named-user"}, AssignmentBasis: "named"}}},
	})
	if len(merged.Tasks) != 1 || merged.Tasks[0].AssignmentBasis != "named" || merged.Tasks[0].AssigneeIDs[0] != "named-user" {
		t.Fatalf("named assignment was not preserved: %#v", merged.Tasks)
	}
}

func TestSanitizeResolvesInflectedUzbekName(t *testing.T) {
	result := sanitize(Result{Tasks: []Task{{Title: "Hisobot", AssigneeIDs: []string{"Eldorga"}, AssignmentBasis: "named", Priority: "high"}}},
		[]Participant{{ID: "eldor-id", Name: "Eldor Karimov"}}, time.Now())
	if len(result.Tasks) != 1 || len(result.Tasks[0].AssigneeIDs) != 1 || result.Tasks[0].AssigneeIDs[0] != "eldor-id" {
		t.Fatalf("inflected name did not resolve: %#v", result.Tasks)
	}
}

func TestResolveNameIsUniversalForOrderHonorificAndDiacritics(t *testing.T) {
	participants := []Participant{{ID: "jose-id", Name: "José García"}, {ID: "anna-id", Name: "Anna Müller"}}
	for _, reference := range []string{"Garcia Jose", "Mr. Garcia", "Jose"} {
		if got := resolveName(reference, participants); got != "jose-id" {
			t.Fatalf("%q resolved to %q", reference, got)
		}
	}
	if got := resolveName("Anna", []Participant{{ID: "one", Name: "Anna Müller"}, {ID: "two", Name: "Anna Schmidt"}}); got != "" {
		t.Fatalf("ambiguous name must remain unassigned, got %q", got)
	}
}

func TestSanitizeAssignsEveryoneWithRole(t *testing.T) {
	role, requested := "Product Designer", "Designer"
	result := sanitize(Result{Tasks: []Task{{Title: "Maket", AssignmentBasis: "role", SuggestedRole: &requested, Priority: "medium"}}},
		[]Participant{{ID: "one", Name: "One", Role: &role}, {ID: "two", Name: "Two", Role: &role}}, time.Now())
	if len(result.Tasks[0].AssigneeIDs) != 2 || result.Tasks[0].AssignmentBasis != "role" {
		t.Fatalf("role members were not assigned: %#v", result.Tasks[0])
	}
}

func TestSanitizeInfersProductDesignerWhenModelOmitsRole(t *testing.T) {
	designer, backend := "Product Designer", "Backend Engineer"
	result := sanitize(Result{Tasks: []Task{{
		Title: "To‘lov sahifasining dizaynini yangilash", AssignmentBasis: "unassigned", Priority: "medium",
	}}}, []Participant{
		{ID: "nodira-id", Name: "Nodira Yusupova", Role: &designer},
		{ID: "aziz-id", Name: "Aziz Karimov", Role: &backend},
	}, time.Now())
	task := result.Tasks[0]
	if len(task.AssigneeIDs) != 1 || task.AssigneeIDs[0] != "nodira-id" || task.AssignmentBasis != "role" || task.SuggestedRole == nil || *task.SuggestedRole != designer {
		t.Fatalf("designer was not inferred: %#v", task)
	}
}

func TestSanitizeInfersAllMembersOfSameRole(t *testing.T) {
	finance := "Finance Analyst"
	result := sanitize(Result{Tasks: []Task{{Title: "Keyingi chorak byudjetini qayta hisoblash", Priority: "medium"}}},
		[]Participant{{ID: "one", Name: "One", Role: &finance}, {ID: "two", Name: "Two", Role: &finance}}, time.Now())
	if len(result.Tasks[0].AssigneeIDs) != 2 || result.Tasks[0].AssignmentBasis != "role" {
		t.Fatalf("all finance analysts must be assigned: %#v", result.Tasks[0])
	}
}

func TestSanitizeDoesNotGuessAmbiguousRole(t *testing.T) {
	product, ui := "Product Designer", "UI Designer"
	result := sanitize(Result{Tasks: []Task{{Title: "Checkout dizaynini yangilash", Priority: "medium"}}},
		[]Participant{{ID: "one", Name: "One", Role: &product}, {ID: "two", Name: "Two", Role: &ui}}, time.Now())
	if len(result.Tasks[0].AssigneeIDs) != 0 || result.Tasks[0].AssignmentBasis != "unassigned" {
		t.Fatalf("ambiguous role must stay unassigned: %#v", result.Tasks[0])
	}
}

func TestSanitizeDistinguishesProductDesignerFromUIDesigner(t *testing.T) {
	product, ui := "Product Designer", "UI Designer"
	participants := []Participant{
		{ID: "product-id", Name: "Product", Role: &product},
		{ID: "ui-id", Name: "UI", Role: &ui},
	}
	productResult := sanitize(Result{Tasks: []Task{{
		Title: "To‘lov sahifasidagi chalkash foydalanuvchi oqimini yaxshilash", Priority: "medium",
	}}}, participants, time.Now())
	if ids := productResult.Tasks[0].AssigneeIDs; len(ids) != 1 || ids[0] != "product-id" {
		t.Fatalf("product responsibility was confused: %#v", productResult.Tasks[0])
	}

	uiResult := sanitize(Result{Tasks: []Task{{
		Title: "To‘lov sahifasining rang, tipografiya va komponentlarini yangilash", Priority: "medium",
	}}}, participants, time.Now())
	if ids := uiResult.Tasks[0].AssigneeIDs; len(ids) != 1 || ids[0] != "ui-id" {
		t.Fatalf("UI responsibility was confused: %#v", uiResult.Tasks[0])
	}
}

func TestNamedAssigneeBeatsInferredRoleDuringSanitize(t *testing.T) {
	designer, backend := "Product Designer", "Backend Engineer"
	result := sanitize(Result{Tasks: []Task{{
		Title: "Dizaynni tekshirish", AssigneeIDs: []string{"aziz-id"}, AssignmentBasis: "named", Priority: "medium",
	}}}, []Participant{
		{ID: "nodira-id", Name: "Nodira Yusupova", Role: &designer},
		{ID: "aziz-id", Name: "Aziz Karimov", Role: &backend},
	}, time.Now())
	if len(result.Tasks[0].AssigneeIDs) != 1 || result.Tasks[0].AssigneeIDs[0] != "aziz-id" || result.Tasks[0].AssignmentBasis != "named" {
		t.Fatalf("named assignment must win: %#v", result.Tasks[0])
	}
}

func TestResolveDeadlineUsesNextStrictWeekday(t *testing.T) {
	meeting := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC) // Monday
	friday := ResolveDeadline("Friday", meeting)
	nextMonday := ResolveDeadline("next Monday", meeting)
	if friday == nil || *friday != "2026-09-11" || nextMonday == nil || *nextMonday != "2026-09-21" {
		t.Fatalf("weekday resolution failed: Friday=%v next Monday=%v", friday, nextMonday)
	}
}
