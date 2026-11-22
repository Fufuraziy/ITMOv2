// Package suggestions — заявки посетителей куратору на новые подборки (docs/requirements.md, R8).
package suggestions

import (
	"context"
	"errors"
	"math"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// Suggestion — заявка на подборку. Email в ответы API не попадает.
type Suggestion struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Occasion  string    `json:"occasion"`
	Budget    int       `json:"budget"`
	Comment   string    `json:"comment"`
	Email     string    `json:"-"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// Input — данные формы заявки. Budget — число из JSON как есть: дробное или NaN отклоняется проверкой.
type Input struct {
	Title    string
	Occasion string
	Budget   float64
	Comment  string
	Email    string
}

// Границы полей (R8).
const (
	TitleMin    = 3
	TitleMax    = 80
	BudgetMin   = 300
	BudgetMax   = 20000
	OccasionMax = 40
	CommentMax  = 500
)

// ValidationError перечисляет все неверные поля: поле → причина (required, too_short, too_long, out_of_range, invalid).
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "invalid suggestion" }

// ErrDuplicate — заявка с таким названием уже есть.
var ErrDuplicate = errors.New("duplicate suggestion")

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// Service хранит заявки в памяти процесса.
type Service struct {
	now   func() time.Time
	mu    sync.Mutex
	items []Suggestion
}

// NewService создаёт пустое хранилище; now — источник времени created_at.
func NewService(now func() time.Time) *Service {
	return &Service{now: now}
}

// Create проверяет и сохраняет заявку.
func (s *Service) Create(ctx context.Context, in Input) (Suggestion, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Occasion = strings.TrimSpace(in.Occasion)
	in.Comment = strings.TrimSpace(in.Comment)
	in.Email = strings.TrimSpace(in.Email)
	if fields := validate(in); len(fields) > 0 {
		return Suggestion{}, &ValidationError{Fields: fields}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, it := range s.items {
		if strings.EqualFold(it.Title, in.Title) {
			return Suggestion{}, ErrDuplicate
		}
	}
	sg := Suggestion{
		ID: int64(len(s.items) + 1), Title: in.Title, Occasion: in.Occasion, Budget: int(in.Budget),
		Comment: in.Comment, Email: in.Email, Status: "new", CreatedAt: s.now().UTC(),
	}
	s.items = append(s.items, sg)
	return sg, nil
}

func validate(in Input) map[string]string {
	fields := map[string]string{}
	switch n := utf8.RuneCountInString(in.Title); {
	case n == 0:
		fields["title"] = "required"
	case n < TitleMin:
		fields["title"] = "too_short"
	case n > TitleMax:
		fields["title"] = "too_long"
	}
	switch b := in.Budget; {
	case math.IsNaN(b) || math.IsInf(b, 0) || b != math.Trunc(b):
		fields["budget"] = "invalid"
	case b == 0:
		fields["budget"] = "required"
	case b < BudgetMin || b > BudgetMax:
		fields["budget"] = "out_of_range"
	}
	if utf8.RuneCountInString(in.Occasion) > OccasionMax {
		fields["occasion"] = "too_long"
	}
	if utf8.RuneCountInString(in.Comment) > CommentMax {
		fields["comment"] = "too_long"
	}
	if in.Email != "" && !emailRe.MatchString(in.Email) {
		fields["email"] = "invalid"
	}
	return fields
}

// List возвращает заявки, новые сначала.
func (s *Service) List(ctx context.Context) ([]Suggestion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := slices.Clone(s.items)
	slices.Reverse(out)
	return out, nil
}
