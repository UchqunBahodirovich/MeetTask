package analysis

import (
	"testing"
	"time"
)

func TestResolveDeadlineWeekdays(t *testing.T) {
	// 2026-09-07 is a Monday.
	monday := time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)
	cases := []struct{ raw, want string }{
		{"dushanbagacha", "2026-09-14"}, // same weekday must jump a full week
		{"juma kunigacha", "2026-09-11"},
		{"ertaga", "2026-09-08"},
		{"keyingi hafta", "2026-09-14"},
		{"next Friday", "2026-09-18"},
		{"seshanbagacha", "2026-09-08"},
		{"chorshanba kuni", "2026-09-09"},
		{"payshanbagacha", "2026-09-10"},
		{"shanbagacha", "2026-09-12"},
		{"yakshanbagacha", "2026-09-13"},
		{"2026-10-01", "2026-10-01"}, // explicit dates pass through
	}
	for _, c := range cases {
		got := ResolveDeadline(c.raw, monday)
		if got == nil || *got != c.want {
			value := "nil"
			if got != nil {
				value = *got
			}
			t.Errorf("%q → %s, kutilgan %s", c.raw, value, c.want)
		}
	}
}
