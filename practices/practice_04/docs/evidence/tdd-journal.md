# Журнал TDD (пишет .claude/skills/tdd-go/scripts/tdd.mjs)

| время | фаза | тест | пакет | вердикт |
|---|---|---|---|---|
| 2026-10-06 15:30:42 | red | `TestService_CreateAndList` | `./internal/collections` | ❌ BUILD FAILED: тест не компилируется, значит он ещё ничего не проверяет. Добавь заглушку с нужной сигнатурой (нулевые значения), чтобы тест падал на утверждении. |
| 2026-10-06 15:31:11 | red | `TestService_CreateAndList` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestService_CreateAndList). |
| 2026-10-06 15:31:13 | red | `TestService_ListReturnsCopies` | `./internal/collections` | ❌ PANIC: тест падает с panic, а не на проверке. Обычно виновата заглушка или фикстура: добейся падения через t.Errorf/t.Fatalf. |
| 2026-10-06 15:31:27 | red | `TestService_ListReturnsCopies` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestService_ListReturnsCopies). |
| 2026-10-06 15:32:04 | green | `TestService_CreateAndList\|TestService_ListReturnsCopies` | `./internal/collections` | ✅ GREEN OK: TestService_CreateAndList, TestService_ListReturnsCopies проходят; весь модуль зелёный. |
| 2026-10-06 15:33:18 | red | `TestService_Create_Validation` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestService_Create_Validation, TestService_Create_Validation/21_товар, TestService_Create_Validation/xml_id_не_положительный, TestService_Create_Validation/все_нарушения_сразу, TestService_Create_Validation/имя_товара_121_символ, TestService_Create_Validation/название_81_символ, TestService_Create_Validation/название_из_2_символов_после_обрезки, TestService_Create_Validation/нет_товаров, TestService_Create_Validation/описание_501_символ, TestService_Create_Validation/повтор_xml_id, TestService_Create_Validation/пустое_имя_товара, TestService_Create_Validation/пустое_название). |
| 2026-10-06 15:33:45 | green | `TestService_Create_Validation` | `./internal/collections` | ✅ GREEN OK: TestService_Create_Validation, TestService_Create_Validation/20_товаров, TestService_Create_Validation/21_товар, TestService_Create_Validation/xml_id_не_положительный, TestService_Create_Validation/все_нарушения_сразу, TestService_Create_Validation/имя_товара_121_символ, TestService_Create_Validation/корректная_подборка, TestService_Create_Validation/название_80_символов_кириллицей, TestService_Create_Validation/название_81_символ, TestService_Create_Validation/название_из_2_символов_после_обрезки, TestService_Create_Validation/название_из_3_символов, TestService_Create_Validation/нет_товаров, TestService_Create_Validation/описание_501_символ, TestService_Create_Validation/повтор_xml_id, TestService_Create_Validation/пустое_имя_товара, TestService_Create_Validation/пустое_название, TestService_Create_Validation/пустое_описание проходят; весь модуль зелёный. |
| 2026-10-06 15:35:03 | red | `^TestAPI_` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_CreateAndList, TestAPI_CreateBadRequest, TestAPI_CreateValidation, TestAPI_ListEmpty, TestAPI_MethodNotAllowed; подслучаев: 4). |
| 2026-10-06 15:35:33 | green | `^TestAPI_` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_CreateAndList, TestAPI_CreateBadRequest, TestAPI_CreateValidation, TestAPI_ListEmpty, TestAPI_MethodNotAllowed; подслучаев: 4 проходят; весь модуль зелёный. |
| 2026-10-06 16:44:17 | red | `TestService_Get\|TestService_GetReturnsCopy` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestService_Get, TestService_GetReturnsCopy; подслучаев: 4). |
| 2026-10-06 16:44:57 | green | `TestService_Get\|TestService_GetReturnsCopy` | `./internal/collections` | ✅ GREEN OK: TestService_Get, TestService_GetReturnsCopy; подслучаев: 4 проходят; весь модуль зелёный. |
| 2026-10-06 16:45:42 | red | `^TestAPI_Get` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_GetByID, TestAPI_GetMethodNotAllowed, TestAPI_GetNotFound; подслучаев: 6). |
| 2026-10-06 16:46:02 | green | `^TestAPI_Get` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_GetByID, TestAPI_GetMethodNotAllowed, TestAPI_GetNotFound; подслучаев: 6 проходят; весь модуль зелёный. |
| 2026-10-06 17:09:19 | red | `^TestNewMemoryStore_\|^TestMemoryStore_` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestMemoryStore_TotalPriceAndCopies, TestNewMemoryStore_DuplicateID, TestNewMemoryStore_Rules; подслучаев: 19). |
| 2026-10-06 17:10:28 | green | `^TestNewMemoryStore_\|^TestMemoryStore_` | `./internal/collections` | ✅ GREEN OK: TestMemoryStore_TotalPriceAndCopies, TestNewMemoryStore_DuplicateID, TestNewMemoryStore_Rules; подслучаев: 22 проходят; весь модуль зелёный. |
| 2026-10-06 17:11:10 | red | `^TestService_\|^TestParseSort$` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestParseSort, TestService_Search, TestService_Tags; подслучаев: 16). |
| 2026-10-06 17:11:35 | green | `^TestService_\|^TestParseSort$` | `./internal/collections` | ✅ GREEN OK: TestParseSort, TestService_Get, TestService_Search, TestService_Tags; подслучаев: 16 проходят; весь модуль зелёный. |
| 2026-10-06 17:12:08 | red | `^TestAPI_` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_GetByID, TestAPI_ReadOnly, TestAPI_Search, TestAPI_SearchBadQuery, TestAPI_Tags; подслучаев: 10). |
| 2026-10-06 17:12:46 | green | `^TestAPI_` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_GetByID, TestAPI_ReadOnly, TestAPI_Search, TestAPI_SearchBadQuery, TestAPI_Tags; подслучаев: 10 проходят; весь модуль зелёный. |
| 2026-10-06 17:13:09 | red | `^TestLoad$\|^TestParse_Errors$` | `./catalog` | ✅ RED OK: падает на проверке поведения (TestLoad, TestParse_Errors). |
| 2026-10-06 17:13:37 | green | `^TestLoad$\|^TestParse_Errors$` | `./catalog` | ✅ GREEN OK: TestLoad, TestParse_Errors проходят; весь модуль зелёный. |
| 2026-10-21 16:21:01 | red | `TestParse_ServingsFields` | `./catalog` | ✅ RED OK: падает на проверке поведения (TestParse_ServingsFields). |
| 2026-10-21 16:22:00 | green | `TestParse_ServingsFields` | `./catalog` | ✅ GREEN OK: TestParse_ServingsFields проходят; весь модуль зелёный. |
| 2026-10-21 16:22:23 | green | `TestParse_ServingsFields` | `./catalog` | ✅ GREEN OK: TestParse_ServingsFields проходят; весь модуль зелёный. |
| 2026-10-21 16:22:54 | red | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestNewMemoryStore_Rules; подслучаев: 3). |
| 2026-10-21 16:23:41 | green | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ GREEN OK: TestNewMemoryStore_Rules; подслучаев: 28 проходят; весь модуль зелёный. |
| 2026-10-21 16:33:46 | red | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestNewMemoryStore_Rules; подслучаев: 2). |
| 2026-10-21 16:36:17 | green | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ GREEN OK: TestNewMemoryStore_Rules; подслучаев: 30 проходят; весь модуль зелёный. |
| 2026-10-21 16:38:07 | red | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestNewMemoryStore_Rules; подслучаев: 2). |
| 2026-10-21 16:38:36 | green | `TestNewMemoryStore_Rules` | `./internal/collections` | ✅ GREEN OK: TestNewMemoryStore_Rules; подслучаев: 32 проходят; весь модуль зелёный. |
| 2026-10-21 16:39:03 | red | `TestParseServings` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestParseServings). |
| 2026-10-21 16:39:28 | green | `TestParseServings` | `./internal/collections` | ✅ GREEN OK: TestParseServings проходят; весь модуль зелёный. |
| 2026-10-21 16:40:15 | red | `TestScale$\|TestScale_RoundsOnce` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestScale, TestScale_RoundsOnce; подслучаев: 3). |
| 2026-10-21 16:40:58 | green | `TestScale$\|TestScale_RoundsOnce` | `./internal/collections` | ✅ GREEN OK: TestScale, TestScale_RoundsOnce; подслучаев: 3 проходят; весь модуль зелёный. |
| 2026-10-21 16:41:23 | red | `TestAPI_Servings` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_Servings). |
| 2026-10-21 16:41:34 | red | `TestAPI_Servings` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_Servings). |
| 2026-10-21 16:42:47 | green | `TestAPI_Servings` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_Servings проходят; весь модуль зелёный. |
| 2026-10-21 16:43:04 | red | `TestScale_CartURL` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestScale_CartURL). |
| 2026-10-21 16:44:00 | green | `TestScale_CartURL` | `./internal/collections` | ✅ GREEN OK: TestScale_CartURL проходят; весь модуль зелёный. |
| 2026-10-21 16:44:40 | red | `TestService_SearchServings` | `./internal/collections` | ✅ RED OK: падает на проверке поведения (TestService_SearchServings; подслучаев: 3). |
| 2026-10-21 16:45:09 | green | `TestService_SearchServings` | `./internal/collections` | ✅ GREEN OK: TestService_SearchServings; подслучаев: 5 проходят; весь модуль зелёный. |
| 2026-10-21 16:46:12 | red | `TestAPI_ErrorCodes` | `./internal/httpapi` | ✅ RED OK: падает на проверке поведения (TestAPI_ErrorCodes; подслучаев: 6). |
| 2026-10-21 16:46:36 | green | `TestAPI_ErrorCodes` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_ErrorCodes; подслучаев: 6 проходят; весь модуль зелёный. |
| 2026-10-21 16:57:55 | red | `TestAPI_ServingsQuantityLimit` | `./internal/httpapi` | ❌ ALREADY GREEN: тест уже проходит (TestAPI_ServingsQuantityLimit) — он не описывает новое поведение. Уточни ожидание или выбери другой сценарий. |
| 2026-10-21 16:57:57 | red | `TestNewMemoryStore_ScalableLimitMessage` | `./internal/collections` | ❌ ALREADY GREEN: тест уже проходит (TestNewMemoryStore_ScalableLimitMessage) — он не описывает новое поведение. Уточни ожидание или выбери другой сценарий. |
| 2026-10-21 16:58:59 | green | `TestAPI_ServingsQuantityLimit` | `./internal/httpapi` | ✅ GREEN OK: TestAPI_ServingsQuantityLimit проходят; весь модуль зелёный. |
| 2026-10-21 16:59:06 | green | `TestNewMemoryStore_ScalableLimitMessage` | `./internal/collections` | ✅ GREEN OK: TestNewMemoryStore_ScalableLimitMessage проходят; весь модуль зелёный. |
