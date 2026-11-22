package httpapi

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"time"

	"vv/collections/internal/suggestions"
)

// Коды ошибок заявок (R8).
const (
	codeInvalidSuggestion   = "invalid_suggestion"
	codeInvalidBody         = "invalid_body"
	codeDuplicateSuggestion = "duplicate_suggestion"
)

type suggestionsResponse struct {
	Total       int                      `json:"total"`
	Suggestions []suggestions.Suggestion `json:"suggestions"`
}

type fieldsErrorBody struct {
	Error  string            `json:"error"`
	Code   string            `json:"code"`
	Fields map[string]string `json:"fields"`
}

// suggestionBody — тело POST. Budget читается как сырое значение: строка или дробь — ошибка поля, а не тела.
type suggestionBody struct {
	Title    string          `json:"title"`
	Occasion string          `json:"occasion"`
	Budget   json.RawMessage `json:"budget"`
	Comment  string          `json:"comment"`
	Email    string          `json:"email"`
}

func (h *handler) listSuggestions(w http.ResponseWriter, r *http.Request) {
	list, err := h.sugg.List(r.Context())
	if err != nil {
		h.internalError(w, err)
		return
	}
	if list == nil {
		list = []suggestions.Suggestion{}
	}
	writeJSON(w, http.StatusOK, suggestionsResponse{Total: len(list), Suggestions: list})
}

func (h *handler) createSuggestion(w http.ResponseWriter, r *http.Request) {
	if h.delay > 0 {
		select {
		case <-time.After(h.delay):
		case <-r.Context().Done():
			return
		}
	}
	var body suggestionBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody{Error: "invalid body: " + err.Error(), Code: codeInvalidBody})
		return
	}
	s, err := h.sugg.Create(r.Context(), suggestions.Input{
		Title: body.Title, Occasion: body.Occasion, Budget: budget(body.Budget), Comment: body.Comment, Email: body.Email,
	})
	var ve *suggestions.ValidationError
	switch {
	case errors.As(err, &ve):
		writeJSON(w, http.StatusBadRequest, fieldsErrorBody{Error: "invalid suggestion", Code: codeInvalidSuggestion, Fields: ve.Fields})
	case errors.Is(err, suggestions.ErrDuplicate):
		writeJSON(w, http.StatusConflict, fieldsErrorBody{Error: "suggestion already exists", Code: codeDuplicateSuggestion,
			Fields: map[string]string{"title": "duplicate"}})
	case err != nil:
		h.internalError(w, err)
	default:
		writeJSON(w, http.StatusCreated, s)
	}
}

// budget: нет поля или null — 0 (required), не число — NaN (invalid).
func budget(raw json.RawMessage) float64 {
	if len(raw) == 0 || string(raw) == "null" {
		return 0
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err != nil {
		return math.NaN()
	}
	return n
}
