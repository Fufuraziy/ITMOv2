# Отчёт 2. Повторные атаки после исправлений

Повторяем атаки из [REPORT_01](./REPORT_01.md) против исправленного
`lab/service.py`. Для каждой дыры — результат после фикса и доказательство
(регрессионный тест в `lab/test_security.py`). Границы стенда (`sandbox.py`,
только `127.0.0.1`) не менялись.

## Результаты повторных атак

| # | Атака | Было | Стало | Тест-доказательство |
|---|---|---|---|---|
| 1 | `GET /profile?id=0 OR 1=1` / IDOR | дамп / чужой профиль | `400` (не число) / `403` чужой / `401` без сессии | `test_profile_id_not_sql_injectable`, `test_customer_cannot_read_other_profile`, `test_profile_requires_session` |
| 2 | `GET /search` дамп ПДн / SQLi | все профили любому | `403` клиенту; литерал не интерпретируется | `test_search_is_staff_only`, `test_search_injection_contained` |
| 3 | `GET /assistant/context?order_id=2` | чужой заказ + SQLi | `404` (не свой), запрос параметризован | `test_assistant_context_scoped_to_owner` |
| 4 | `GET /orders` все заказы | все клиенты | только свои (staff — все) | `test_orders_scoped_to_owner` |
| 5 | `POST /orders price=1` | покупка за 1 ₽ | цена каталога `5000` | `test_price_override_ignored` |
| 6 | `X-Role: staff` → экспорт | эскалация | `403` (роль из сессии) | `test_admin_export_ignores_spoofed_role_header` |
| 7 | `/files?user=../private...` / чужой чек | секрет / IDOR | `403` оба случая | `test_files_traversal_to_private_blocked`, `test_files_cannot_read_other_users_receipt` |
| 8 | `/assistant/execute` без прав | чтение секрета, дамп, удаление | `401` без сессии; `403` чужой файл / private / export клиенту / `delete_tree`; файлы целы | `test_execute_*` (6 тестов) |
| 9 | `<script>` в отзыве | исполняется | экранируется `&lt;script&gt;` | `test_review_html_is_escaped` |
| 10 | отзыв как канал инъекции | XSS + prompt injection | данные экранируются; промпт помечает отзывы как данные; исполнитель перепроверяет права | #8, #9 |
| 11 | `GET /debug/logs` | пароли + токены | `403` клиенту; staff видит логи без тел/заголовков | `test_debug_logs_staff_only_and_no_secrets` |
| 12 | 500 с текстом исключения | утечка внутренностей | `{"error":"internal error"}` | обработчик в `service.py` |

## Prompt injection: проверка независимо от модели

Сценарий «отзыв-инструкция → контекст → исполнение» перепроверен принудительной
отправкой опасного `decision` прямо в `/assistant/execute` (не полагаясь на
послушание LLM):

- `delete_tree(".")` даже от staff → `403`, учебные файлы на месте
  (`test_execute_delete_tree_forbidden`).
- `read_file("private/operator-note.txt")` от клиента → `403`
  (`test_execute_read_private_blocked_for_customer`).
- `export_profiles` от клиента → `403` (`test_execute_export_profiles_staff_only`).

Вывод: сервер ограничивает действие вызвавшего клиента вне зависимости от того,
что вернула модель. Если LLM отвергает инъекцию — тем лучше; но защита не
полагается на это.

## Остаточные риски (честно)

- Сессии не истекают и нет rate-limiting — для учебного локального стенда
  приемлемо, в проде нужны TTL/ротация и лимиты.
- `/health`, `/products` остаются публичными намеренно.
- Защита внутри стенда опирается на неизменность `sandbox.py` (по условию).

## Статус тестов

`test_service.py` (функциональные) и `test_security.py` (регрессионные) — зелёные
на Linux и на нативном Windows Python. `make step6` / `make test` проходят в
окружении грейдера (Linux). Известные локальные артефакты, не связанные с кодом:
в WSL1 на этой машине зависает loopback у `test_http.py`, а на Windows без режима
разработчика `test_symlink_cannot_escape_exercise` требует привилегии создания
симлинков (WinError 1314).
