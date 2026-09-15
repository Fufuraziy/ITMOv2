# Журнал экспериментов Практики 2

- Выбранный слабый артефакт Практики 1: practices/practice_01/tests_load.md
- Что в нём нужно улучшить: цели по p95 и допускам несогласованы с problem.md (там SLO <3s, здесь указано p95 <1.5s/2s), не задан конкретный лимит N и обоснование RPS, отсутствует методика измерений (инструмент, среда, способ съёма метрик) и связь с продуктовой метрикой «доля 5xx vs 2xx/4xx». Нужно: выровнять цели с problem.md, зафиксировать N, обосновать/зафиксировать RPS, описать воспроизводимый план (инструмент, профиль, как считаем p95/коды).
- Как поймём, что изменение полезно: сценарии нагрузочного теста согласованы с product/problem метриками, содержат конкретные N и RPS с источником, описан воспроизводимый запуск (напр. k6/locust, фиксированная среда), и фактические результаты дают p95 ≤ 3s для «разумных диффов», долю 5xx ≤ 1% и 100% 413 при превышении лимита. Эти цели совпадают с SLO из problem.md и используются в DoD.

| Техника | Файл эксперимента | Изменённый файл Практики 1 | Конкретное изменение | Проверка | Что отклонили |
|---|---|---|---|---|---|
| Few-shot | [`few_shot/experiment.md`](few_shot/experiment.md) | practices/practice_01/tests_load.md | Переписана копия в стиле эталона: добавлены «Правила и SLO», «Методика», таблица и пример k6 | Сверка с chain_of_verification/tests_load.md; соответствие problem.md и CASE.md | Старые p95 < 1.5s/2s, отсутствующий N, произвольные RPS |
| R.C.T.F. | [`rctf/experiment.md`](rctf/experiment.md) | practices/practice_01/tests_load.md | Исправленная копия: таблица с явными порогами, методика k6, блок «обоснование отсрочки» | Проверка наличия N=20000, p95 ≤ 3s и 5xx ≤ 1%, и условий снятия отсрочки | Порог p95 < 1.5s/2s, отсутствие методики и решения по запуску |
| Chain of Verification | [`chain_of_verification/experiment.md`](chain_of_verification/experiment.md) | practices/practice_01/tests_load.md | Вынесена исправленная версия с явным N=20000, согласованными p95 ≤ 3s, добавлена методика (k6) | Сверка с problem.md и CASE.md; проверка таблицы сценариев и наличия методики | Порог p95 < 1.5s/2s без обоснования, произвольные RPS |
| Tree of Thoughts | [`tree_of_thoughts/experiment.md`](tree_of_thoughts/experiment.md) | practices/practice_01/tests_load.md | ToT: выбрана ветвь 2 (MVP-smoke), переработан файл с обоснованием отсрочки | Проверка наличия smoke-сценариев, DoD и блока отсрочки | Немедленный полный запуск; переход на async на этом этапе |
| RAG | [`rag/experiment.md`](rag/experiment.md) | practices/practice_01/tests_load.md | RAG-версия: добавлен Context с ссылками на problem.md, CASE.md и k6 docs; thresholds и методика | Проверка ссылок: соответствие SLO и API-1/REL-1; соответствие синтаксису k6 | Порог p95 < 1.5s/2s, нефиксированный N, отсутствие методики |
| ReAct | [`react/experiment.md`](react/experiment.md) | practices/practice_01/tests_load.md | ReAct-версия: фиксация N=20000, согласование SLO, методика k6, решение о запуске | Проверка наличия thresholds, условий старта и сценариев | Старые пороги p95, отсутствие решения о запуске |

## Независимое ревью

| Замечание другой команды | Где исправили | Evidence |
|---|---|---|
| Двусмысленность | chain_of_verification/tests_load.md; few_shot/tests_load.md; react/tests_load.md | problem.md 22–29 (SLO p95 ≤ 3s); CASE.md 64–71 (API-1: N=20000); practices/practice_01/tests_load.md 5–7 (p95 1.5s/2s) |
| Непроверяемое требование | rag/tests_load.md; chain_of_verification/tests_load.md | rag/tests_load.md — thresholds и k6-скрипт; k6 Thresholds docs https://k6.io/docs/using-k6/thresholds/ |
| Пропущенный риск или источник | rctf/tests_load.md; tree_of_thoughts/tests_load.md | analysis.md (ошибки LLM → 500); problem.md 22–29; rctf/tests_load.md — блок «Решение о запуске» |
