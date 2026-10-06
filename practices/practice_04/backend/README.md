# Бэкенд поиска подборок

Go 1.22+, только стандартная библиотека, только чтение. Контракт — [`docs/requirements.md`](../docs/requirements.md).

- `catalog` — встраивает `collections.json` (собирает `mcp/vv-collections/curate.mjs`).
- `internal/collections` — модель, правила каталога R3, `MemoryStore` (проверка R1, `total_price`), поиск R2 и теги R5.
- `internal/httpapi` — `GET /collections?q=&tag=&max_price=&sort=`, `GET /collections/{id}`, `GET /tags`.
- `cmd/api` — запуск; адрес из `ADDR` (по умолчанию `:8080`). Невалидный каталог — сервер не стартует и перечисляет проблемы.

```sh
sh scripts/dev-backend.sh          # из корня: запуск на 127.0.0.1:8080
sh scripts/check.sh backend        # gofmt, go vet, go test
```

Нет Go — `bash scripts/bootstrap-go.sh` поставит портативный в `.tools/go-<ос>`; всё окружение целиком — `bash scripts/setup.sh`. Postgres — следующий шаг (реализация `Store`).
