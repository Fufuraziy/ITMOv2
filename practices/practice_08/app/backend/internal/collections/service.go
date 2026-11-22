package collections

import "context"

// Service — поиск по каталогу подборок.
type Service struct {
	store Store
}

// NewService создаёт сервис поверх хранилища.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Get возвращает подборку по id или ошибку, обёртывающую ErrNotFound.
func (s *Service) Get(ctx context.Context, id string) (Collection, error) {
	return s.store.Get(ctx, id)
}
