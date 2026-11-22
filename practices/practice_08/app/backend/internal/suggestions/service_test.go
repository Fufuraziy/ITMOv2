package suggestions_test

import (
	"context"
	"errors"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"

	"vv/collections/internal/suggestions"
)

var t0 = time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC)

// clock отдаёт t0, t0+1m, t0+2m… — порядок заявок виден по времени.
func clock() func() time.Time {
	n := 0
	return func() time.Time {
		n++
		return t0.Add(time.Duration(n-1) * time.Minute)
	}
}

func valid() suggestions.Input {
	return suggestions.Input{Title: "Ужин на двоих", Occasion: "ужин", Budget: 1500, Comment: "паста и салат", Email: "anna@example.ru"}
}

func TestService_Create(t *testing.T) {
	svc := suggestions.NewService(clock())
	in := valid()
	in.Title = "  Ужин на двоих  "

	got, err := svc.Create(context.Background(), in)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	want := suggestions.Suggestion{ID: 1, Title: "Ужин на двоих", Occasion: "ужин", Budget: 1500,
		Comment: "паста и салат", Email: "anna@example.ru", Status: "new", CreatedAt: t0}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Create = %+v, want %+v", got, want)
	}
}

func TestService_CreateValidation(t *testing.T) {
	tests := []struct {
		name  string
		patch func(*suggestions.Input)
		want  map[string]string
	}{
		{"пустое название", func(in *suggestions.Input) { in.Title = "   " }, map[string]string{"title": "required"}},
		{"короткое название", func(in *suggestions.Input) { in.Title = "Уж" }, map[string]string{"title": "too_short"}},
		{"длинное название", func(in *suggestions.Input) { in.Title = strings.Repeat("я", 81) }, map[string]string{"title": "too_long"}},
		{"нет бюджета", func(in *suggestions.Input) { in.Budget = 0 }, map[string]string{"budget": "required"}},
		{"бюджет меньше 300", func(in *suggestions.Input) { in.Budget = 299 }, map[string]string{"budget": "out_of_range"}},
		{"бюджет больше 20 000", func(in *suggestions.Input) { in.Budget = 20001 }, map[string]string{"budget": "out_of_range"}},
		{"отрицательный бюджет", func(in *suggestions.Input) { in.Budget = -50 }, map[string]string{"budget": "out_of_range"}},
		{"дробный бюджет", func(in *suggestions.Input) { in.Budget = 1500.5 }, map[string]string{"budget": "invalid"}},
		{"бюджет не число", func(in *suggestions.Input) { in.Budget = math.NaN() }, map[string]string{"budget": "invalid"}},
		{"длинный повод", func(in *suggestions.Input) { in.Occasion = strings.Repeat("я", 41) }, map[string]string{"occasion": "too_long"}},
		{"длинный комментарий", func(in *suggestions.Input) { in.Comment = strings.Repeat("я", 501) }, map[string]string{"comment": "too_long"}},
		{"почта без домена", func(in *suggestions.Input) { in.Email = "anna@" }, map[string]string{"email": "invalid"}},
		{"почта с пробелом", func(in *suggestions.Input) { in.Email = "an na@example.ru" }, map[string]string{"email": "invalid"}},
		{"все ошибки сразу", func(in *suggestions.Input) { in.Title = ""; in.Budget = 10; in.Email = "x" },
			map[string]string{"title": "required", "budget": "out_of_range", "email": "invalid"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := suggestions.NewService(clock())
			in := valid()
			tt.patch(&in)

			_, err := svc.Create(context.Background(), in)
			var ve *suggestions.ValidationError
			if !errors.As(err, &ve) {
				t.Fatalf("Create error = %v, want *ValidationError", err)
			}
			if !reflect.DeepEqual(ve.Fields, tt.want) {
				t.Errorf("Fields = %v, want %v", ve.Fields, tt.want)
			}
			if list, _ := svc.List(context.Background()); len(list) != 0 {
				t.Errorf("invalid suggestion stored: %+v", list)
			}
		})
	}
}

func TestService_CreateOptionalFieldsAndLimits(t *testing.T) {
	svc := suggestions.NewService(clock())
	in := suggestions.Input{Title: "Суп", Budget: 300}
	if _, err := svc.Create(context.Background(), in); err != nil {
		t.Errorf("minimal input: %v", err)
	}
	in = suggestions.Input{Title: strings.Repeat("я", 80), Budget: 20000,
		Occasion: strings.Repeat("я", 40), Comment: strings.Repeat("я", 500)}
	if _, err := svc.Create(context.Background(), in); err != nil {
		t.Errorf("input at limits: %v", err)
	}
}

func TestService_CreateDuplicate(t *testing.T) {
	svc := suggestions.NewService(clock())
	if _, err := svc.Create(context.Background(), valid()); err != nil {
		t.Fatalf("first Create: %v", err)
	}
	dup := valid()
	dup.Title = " УЖИН на двоих "
	if _, err := svc.Create(context.Background(), dup); !errors.Is(err, suggestions.ErrDuplicate) {
		t.Errorf("duplicate Create error = %v, want ErrDuplicate", err)
	}
}

func TestService_ListNewestFirst(t *testing.T) {
	svc := suggestions.NewService(clock())
	for _, title := range []string{"Первая", "Вторая", "Третья"} {
		in := valid()
		in.Title = title
		if _, err := svc.Create(context.Background(), in); err != nil {
			t.Fatalf("Create %s: %v", title, err)
		}
	}
	list, err := svc.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	var got []string
	for _, s := range list {
		got = append(got, s.Title)
	}
	if want := []string{"Третья", "Вторая", "Первая"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("List titles = %v, want %v", got, want)
	}
	if list[0].ID != 3 || !list[0].CreatedAt.Equal(t0.Add(2*time.Minute)) {
		t.Errorf("newest = %+v, want id 3 at t0+2m", list[0])
	}
}
