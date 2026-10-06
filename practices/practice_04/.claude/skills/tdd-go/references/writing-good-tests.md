# Хорошие тесты для бэкенда подборок

## Проверяй поведение через публичный интерфейс

Тест описывает то, что видит клиент: `Service.Create` возвращает ошибку валидации, `POST /collections` отвечает 422 с перечнем проблем. Не проверяй приватные поля и порядок внутренних вызовов — после рефакторинга такой тест ломается без изменения поведения.

## Один сценарий — один подслучай

```go
func TestService_Create_Validation(t *testing.T) {
	tests := []struct {
		name    string
		in      collections.NewCollection
		problem string // фрагмент ожидаемой проблемы
	}{
		{"пустое название", valid(func(c *collections.NewCollection) { c.Title = "  " }), "title"},
		{"нет товаров", valid(func(c *collections.NewCollection) { c.Products = nil }), "products"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newService().Create(context.Background(), tt.in)
			var verr *collections.ValidationError
			if !errors.As(err, &verr) {
				t.Fatalf("want ValidationError, got %v", err)
			}
			// ...
		})
	}
}
```

- Имя подслучая говорит о сценарии, а не о входных данных: `"повтор xml_id"`, а не `"case3"`.
- Начинай с корректного объекта (`valid(...)`) и портить по одному полю — так видно, что именно ломает вход.
- Ошибки проверяй через `errors.As` / `errors.Is`, а не сравнением строк целиком.

## Сообщение о падении объясняет разницу

`t.Errorf("status = %d, want %d; body: %s", got, want, body)` — по выводу понятно, что сломалось, без отладчика. Вердикт `RED OK` в `tdd.mjs` показывает это сообщение: если по нему нельзя понять причину, перепиши.

## HTTP-слой

- `httptest.NewRecorder` + `srv.ServeHTTP` — быстрее и без портов; `httptest.NewServer` — когда важен настоящий клиент.
- Проверяй код ответа, `Content-Type` и тело. Тело ошибки — JSON `{"error": ..., "details": [...]}`.

## Изоляция и скорость

- Каждый тест создаёт свой `MemoryStore` и генератор id; общих глобальных переменных нет.
- Без `time.Sleep` и сети: весь `go test ./...` должен идти секунды — его запускает hook после каждой правки.
- Хранилище Postgres (когда появится) тестируется отдельно и пропускается без `DATABASE_URL`.
