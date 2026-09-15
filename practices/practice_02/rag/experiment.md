# RAG

- Вопрос к источникам:
  Как корректно оформить нагрузочные проверки для `/api/reviews`, если исходный артефакт practices/practice_01/tests_load.md не фиксирует N, использует несогласованные пороги p95 и не описывает методику?

## Разрешённые источники

| Файл или документ | Зачем нужен | Какой фрагмент используем |
|---|---|---|
| practices/practice_01/problem.md | Продуктовый SLO | p95 времени ответа для «разумных диффов» ≤ 3s; снижение 5xx за счёт валидации (стр. 22–29) |
| practices/practice_01/CASE.md | Правила репозитория | API-1: diff > 20 000 символов → 413; REL-1: timeout внешнего LLM 10s (раздел «Правила репозитория», строки 64–71) |
| Grafana k6: Metrics | Официальные метрики k6 | http_req_duration, http_req_failed и их percentiles/rates — https://k6.io/docs/using-k6/metrics/ |
| Grafana k6: Thresholds | Как зафиксировать SLO в тесте | Синтаксис thresholds и пример для http_req_failed и http_req_duration — https://k6.io/docs/using-k6/thresholds/ |

## Запрос

Собрать надёжную версию «Нагрузочных проверок» с:
- явным N=20000 (CASE.md API-1);
- порогами, согласованными с problem.md (p95 ≤ 3s, 5xx ≤ 1%);
- воспроизводимой методикой k6 и threshold-ами на http_req_failed и http_req_duration по официальной документации.

## Ответ со ссылками на источники

1. Порог ошибки <1% и p95 ≤ 3s задаются как thresholds k6: `http_req_failed: ['rate<0.01']`, `http_req_duration: ['p(95)<3000']` — k6 Thresholds, раздел «Thresholds example for HTTP errors and response duration» (https://k6.io/docs/using-k6/thresholds/). Метрики — k6 Metrics (https://k6.io/docs/using-k6/metrics/).
2. Значение N=20000 фиксировано правилом API-1 — practices/practice_01/CASE.md (раздел «Правила репозитория»).
3. Цели p95 ≤ 3s и контроль 5xx соответствуют problem.md (строки 22–25, 24–29).

На основе этих фактов сформирован файл practices/practice_02/rag/tests_load.md.

## Что изменили в исходном артефакте

- Файл и раздел:
  practices/practice_01/tests_load.md (таблица сценариев и отсутствие методики).
- Изменение:
  Создан новый артефакт practices/practice_02/rag/tests_load.md: добавлены «Context» с источниками, «Правила и SLO», «Методика и воспроизводимость», таблица сценариев с явным N=20000 и порогами p95 ≤ 3s, 5xx ≤ 1%, пример k6-скрипта с thresholds.
- Как проверили ссылки:
  Сопоставили используемые метрики и синтаксис thresholds с k6 Metrics/Thresholds; пороги p95/5xx — с problem.md; значение N и статусы 413 — с CASE.md.
- Что отклонили как неподтверждённое:
  p95 < 1.5s/2s без обоснования; нефиксированный N; произвольные RPS без ссылки на модель нагрузки.
