# План развития диаграмм SlideCraft по результатам review Diagram Design

> План составлен 24 октября 2026; реализация добавлена 25 октября. Ниже сохранён исходный инженерный checklist, а фактическое покрытие и незакрытая Office-приёмка перечислены в [отчёте о реализации](diagram-design-implementation-2026-10.md). Основание: [исследование и карта возможностей](diagram-design-review-2026-10.md).

## Цель и рекомендуемый первый результат

Расширить набор консультационных и технических diagrams, сохранив общий Scene IR, темы, проверяемые данные и редактируемый PPTX.

Первый пользовательский пакет: **heatmap, fishbone, treemap, dumbbell и slopegraph**. Это три новых layouts и два варианта `chart-takeaway`. Следующий самостоятельный результат — **architecture delta** с устойчивым сопоставлением компонентов до/после. Sankey идёт после проверки прозрачности и количественных invariants.

План не меняет текущий [ROADMAP](../../ROADMAP.md) и не назначает даты релизов. Приоритеты — инженерная рекомендация; оценки трудоёмкости и спроса потребуют отдельного уточнения после первых прототипов.

Внешний вид описан в [визуальной спецификации для PowerPoint](diagram-design-visual-spec-2026-10.md): композиции, типографика для чтения и показа, theme tokens, рецепты для каждого приоритетного типа и визуальные критерии приёмки. Построены два синтетических deck по 33 слайда; все HTML-рендеры просмотрены. Проверка actual Office render остаётся открытой.

## Принятые для плана решения

- Все пользовательские diagrams строятся через зарегистрированные layouts и Scene, работают в общей композиции и экспортируются штатными backends.
- Названия и пределы ниже отражают исходное предложение. Актуальный доступный API и точные ограничения приведены в [руководстве](../how-to/create-diagrams.md), а различия с планом — в [отчёте](diagram-design-implementation-2026-10.md).
- Используем собственные theme tokens, text measurement, chrome и source handling. Upstream — источник требований и сценариев проверки.
- Новая графическая структура получает layout; изменение того же представления — variant; отраслевое применение — preset/example/semantic route.
- Графики из editable shapes допустимы. В документации отличаем их от Office charts с редактируемой встроенной таблицей данных.
- Импорт Mermaid/draw.io/Excalidraw выделяем в отдельный будущий этап; он не блокирует первую библиотеку нативных diagrams.
- Не копируем клиентские decks в fixtures. Все новые fixtures — общие синтетические примеры с явной маркировкой illustrative.

## Уже выполнено в исследовании

- [x] Зафиксированы upstream commit и локальный HEAD.
- [x] Сопоставлены все 45 upstream visual types и важные chart variants с нашим registry из 46 layouts.
- [x] Разделены существующие возможности, частичное покрытие и отсутствующие contracts.
- [x] Прочитаны ключевые type references, semantic patterns, geometry/quantitative checks и лицензии.
- [x] Просмотрены четыре опубликованных PNG: Sankey, treemap, architecture delta, service blueprint.
- [x] Выявлен пробел обработки `PathNode.fillOpacity` в SVG/PPTX/native PDF; описана граница статической проверки.
- [x] Подготовлены приоритеты, последовательность работ и критерии приёмки.
- [x] Описано визуальное направление для PowerPoint; создание и проверка эталонных макетов остаются задачей реализации.

## Последовательность реализации

| Этап | Результат | Зависимости | Можно завершить отдельно |
|---|---|---|---|
| A | Contracts, визуальные эталоны и provenance policy | Это исследование и визуальная спецификация | Да |
| B1 | Path opacity и общая проверка геометрии данных | A | Да; требуется до Sankey |
| B2 | Connector metadata, routing и graph QA | A | Да; улучшает текущий `architecture` |
| C | Heatmap, paired comparisons, fishbone, treemap | A; нужные quantitative helpers | Да; не ждёт полного graph router |
| D | Architecture delta, затем swimlane | B2 | Каждый layout отдельно |
| E | Sankey, loop и layer stack | B1 для Sankey; B2 для graph connections | Каждый layout отдельно |
| F | Journey и service blueprint | A, shared stage-grid helper | Да; не обязаны ждать E |
| G | Flowchart, sequence, state и ограниченный diagram import | B2; contracts целевых diagrams до импорта | По отдельным сценариям |
| H | Остальной backlog по подтверждённым кейсам | Результаты ранних этапов | Да |

### A. Зафиксировать контракты и правила переноса

- [ ] Описать ADR: diagram semantics живут в content/contracts, общая геометрия — в engine, serializers только экспортируют.
- [ ] Выбрать для первой волны по одному реалистичному синтетическому сценарию и нескольким граничным данным.
- [ ] Описать для каждого exhibit question/useWhen/avoidWhen, обязательные поля, ограничения и правила источников.
- [ ] Подготовить кандидаты визуальной композиции и выбрать эталон по [дизайн-спецификации](diagram-design-visual-spec-2026-10.md); проверить читаемость в PowerPoint до расширения библиотеки.
- [ ] Установить правило происхождения: если переносится upstream code/text, записать commit, файл и характер адаптации; включить MIT notice в поставляемый пакет и обновить `NOTICE`.
- [ ] Добавить маршрут в `src/library/exhibits.ts` только вместе с реально зарегистрированным layout; для будущих типов хранить предложения в плане.

**Приёмка:** контракт объясняет, какую задачу решает exhibit и как отклоняется неоднозначный ввод; есть визуальный эталон с зафиксированными режимом использования и темой; нет параллельного registry, обходящего `src/layouts/index.ts`.

### B1. Проверить основу для количественной геометрии

- [ ] Минимальным fixture воспроизвести отсутствие `fillOpacity` у PathNode во всех основных exporters; затем исправить общий путь SVG/PPTX/native PDF. Проверить и optional backend, если он объявляет поддержку соответствующего свойства.
- [ ] Проверить cubic paths, fill/stroke, bounds и drawing order на одних и тех же примитивах в HTML/PDF/PPTX.
- [ ] При необходимости добавить `ctx.path()` поверх существующего PathNode/`ctx.add`, с вычислением bounds и сохранением pointer. Не вводить новый тип кривой без необходимости.
- [ ] Выделять scale/area/balance helpers по мере появления двух потребителей; не проектировать универсальный chart engine заранее.
- [ ] Определить metadata, связывающие исходное значение, единицу и визуальную геометрию. QA должна сравнивать реальные размеры с данными, а не доверять готовому label.

**Модули:** `src/engine/scene.ts`, `src/engine/context.ts`, `src/layouts/types.ts`, `src/engine/svg-path.ts`, `src/backends/svg.ts`, `src/backends/pptxgenjs.ts`, `src/backends/native-pdf.ts`. Новые helpers — только при обоснованной необходимости.

**Приёмка:** прозрачность проверяется в сериализованных артефактах и actual render; один и тот же path остаётся editable freeform в PPTX. Неподдерживаемое свойство не пропадает молча.

### B2. Добавить общие соединения и graph QA

- [ ] Согласовать обратно совместимое представление node IDs, endpoint IDs, ports, containers и edge labels. Рассмотреть metadata существующих Scene nodes прежде, чем добавлять новый Scene kind.
- [ ] Вынести ограниченный deterministic router для небольших graphs: ортогональные трассы, отдельные порты на общей грани, обход чужих блоков, область для подписи.
- [ ] Явно ограничить область первой версии router. Если читаемое размещение в бюджете невозможно, выдавать диагностику с pointer и предложением разбиения; не удалять edges.
- [ ] Добавить checks для неизвестных/повторных ID, неоднозначных endpoint, наложенных трасс, пересечения label/node, транзита через чужой node.
- [ ] Дать проверкам доступ к семантике: group/container overlap допустим; обычный узел поверх чужого label — нет.
- [ ] Перевести существующий `architecture` на shared helper и проверить регрессию существующих примеров.

**Предлагаемые новые модули:** `src/engine/diagram-geometry.ts`, `src/engine/diagram-routing.ts`, `src/qa/diagram-checks.ts`; финальная декомпозиция определяется реализацией.

**Приёмка:** правило применяется ко всем layouts-потребителям и не зависит от deck ID/названия. Diagonal data lines, fishbone bones и Sankey ribbons не получают ошибочный запрет как обычные graph connectors. Не обещать привязку коннектора при ручном перемещении узла в PowerPoint без отдельной проверки OOXML connections.

### C. Выпустить первую группу полезных exhibits

Все численные пределы в следующей таблице — **стартовые ограничения для прототипов**, не уже существующие API и не пределы upstream. Их нужно подтвердить измерением текста в темах и форматах SlideCraft.

| Возможность | Предлагаемый контракт | Обязательная проверка |
|---|---|---|
| `heatmap` | `rows`, `columns`, `values`, `unit`, scale/domain, optional focal cell; начальный бюджет до 6 × 6 | Размерность матрицы; единая шкала; ноль отличается от missing; отрицательные значения требуют явно подходящей шкалы; текст контрастен на фактической заливке |
| `chart-takeaway/dumbbell` | Две сравнимые series по одинаковым categories; labels периодов и единица; до 8 категорий | Ровно две точки на категорию; одна шкала; равенство и смена направления; missing не превращается в ноль |
| `chart-takeaway/slopegraph` | Тот же paired-data contract, две подписанные оси и endpoints | Одинаковый domain обеих осей; label displacement не двигает сами данные; crossings сохраняются |
| `fishbone` | `effect`, `categories[].causes[]`, evidence status, optional focal cause; сначала до 5 категорий | Hypothesis не становится confirmed из-за выделения; причина без доказательства допустима только с честным статусом; длинные подписи не пересекают bones |
| `treemap` | Items с устойчивыми ID, value, label, unit; сначала плоский набор 4–8 элементов | Площадь пропорциональна значению; сумма долей; стабильный tie-break; корректная обработка нулей/малых долей; no silent grouping |

- [ ] Начать с heatmap и fishbone: они не требуют общего graph router.
- [ ] Для dumbbell/slopegraph переиспользовать двухсерийные данные, но написать общую paired-comparison geometry. Не притворяться, что существующий native `line` chart уже даёт нужные подписи.
- [ ] Для treemap использовать deterministic squarified layout; проверить относительную ошибку площади после gutters. Не увеличивать маленькие cells ради текста.
- [ ] В каждой schema ограничить строки и массивы, указать `.describe()` и output/редактируемость.
- [ ] Предлагать объединение хвоста treemap как авторское решение с явным составом Other; не менять входные значения молча.
- [ ] Обновить registry, semantic routes, reference, examples и gallery для реально реализованных типов.

**Приёмка:** все пять возможностей доступны через CLI/contracts, проходят общий layout harness во всех темах, помещаются в `composition` там, где заявлены composable, и имеют проверенные HTML/PPTX/PDF. Во всех примерах заголовок доказывается данными.

### D. Сделать architecture delta, затем настоящий swimlane

**Architecture delta — новый layout поверх общего graph layer.**

- [ ] Контракт `before`, `after`, stable node/edge IDs, explicit semantic attributes; одинаковый ID означает тот же объект.
- [ ] Разделить semantic change, topology change и авторское перемещение. Layout rerouting сам по себе не считается rewired edge.
- [ ] Строить обе картинки на общей сетке; неизменённые компоненты сохраняют положение. Начать с общего бюджета до 8 уникальных nodes.
- [ ] Changes ledger вычислять или проверять по двум snapshots. Не допускать нарисованного удаления без записи и записи о добавлении без нового объекта.
- [ ] Статусы передавать словами/знаками/линиями; цвет только дополняет их.
- [ ] При переполнении предлагать overview/detail с сохранением IDs и полного ledger.

**Swimlane — отдельный layout, сохраняющий смысл существующего `process-compare`.**

- [ ] Контракт `lanes`, `steps` с owner/lane ID, `edges`; начальный бюджет до 4 lanes и 8 steps.
- [ ] Проверять переходы между lanes и принадлежность шага роли; развилки добавлять только при явно заявленной поддержке.
- [ ] Использовать shared router, label fitting и источники; покрыть возврат и handoff через промежуточную lane.

**Приёмка:** delta показывает реальные изменения topology; swimlane показывает ответственность и handoffs. Старые `before-after` и `process-compare` сохраняют прежние contracts.

### E. Добавить Sankey и отдельные diagram structures

**Sankey.**

- [ ] MVP: ровно три stages, до 8 nodes и 12 flows; это предложенное ограничение первой версии, которое можно расширить после QA.
- [ ] Контракт: stable IDs, stage, `flows: {from, to, value}`, единая unit, focal path. Разрешать только конечные неотрицательные величины; нулевой flow не рисовать как положительный.
- [ ] Внутренние узлы сохраняют баланс; stage totals согласованы. Потери показывать явным sink, а не незаметным сужением ribbons.
- [ ] Один масштаб для всех nodes и ribbons. Tiny flows не раздувать до минимальной толщины с ложным объёмом: диагностика и явное агрегирование/разбиение.
- [ ] Использовать закрытые cubic paths из Scene; сохранять одинаковую толщину обоих концов, attachment intervals и устойчивый порядок flows.
- [ ] Добавить negative tests: нарушенный баланс, другая шкала столбца, ribbon narrowing, неправильное подключение, несовпадение label и geometry, потеря прозрачности.

**Loop / layer stack.**

- [ ] Loop: этапы цикла, явное замыкание, optional hub; отметить, является ли reinforcement гипотезой или подтверждённым механизмом.
- [ ] Layer stack: уровни и направление зависимости/абстракции; не переиспользовать pyramid как визуально похожую фигуру с другим смыслом.

**Приёмка:** quantitative checks запускаются до экспорта и завершаются ошибкой при несогласованных данных. PowerPoint содержит редактируемые ribbons и отдельные labels; пример проходит visual QA реального PPTX и HTML.

### F. Построить customer journey и service blueprint

- [ ] Вынести stage-grid helper, общий для таблицы этапов, подписей строк и согласованных колонок.
- [ ] Journey: persona, stages, actions/touchpoints, sentiment scale, evidence/source, optional pain points. Не выводить sentiment автоматически из текста агента.
- [ ] Blueprint: customer/frontstage/backstage как обязательные строки, optional evidence/support, line of visibility; отсутствующая ячейка имеет явное значение N/A.
- [ ] Сохранить разные semantic contracts: sentiment curve не заменяет границу видимости, а blueprint не становится swimlane без handoff edges.
- [ ] Сначала ограничить 4–6 этапами и короткими actions; размер текста подтверждать по body после title/source reservations.

**Приёмка:** один синтетический сервис представлен двумя views, каждая отвечает на свой вопрос. Без источника sentiment отображается как hypothesis или отклоняется согласно явно выбранному режиму.

### G. Технические diagrams и импорт — отдельные инкременты

1. Flowchart: start/end/process/decision, подписанные ветки, merge, ограниченный цикл; отдельная валидация графа.
2. Sequence: participants, ordered messages, return/self-call, затем bounded fragments; не моделировать время горизонтальной позицией architecture boxes.
3. State: initial/terminal states, transitions/guards, retries; lifecycle — semantic pattern поверх этого типа.
4. Diagram import после готовности целевых contracts: сначала ограниченный Mermaid subset, затем draw.io/Excalidraw по спросу.

Для импорта предусмотреть нормализованные nodes/edges/containers и отчёт: preserved, merged, omitted, unsupported. Links/directives/labels — данные; парсер не выполняет код и не обращается к ссылкам из входа. Пределы размера, рекурсии и числа объектов обязательны для устойчивой обработки. Полный Mermaid parser в MVP не обещать. [Ограничения изученного upstream extractor](diagram-design-review-2026-10.md).

### H. Backlog после подтверждения сценариев

| Группа | Кандидаты | Когда возвращаться |
|---|---|---|
| Технические модели | ER, database schema, UML class, deployment, dependency graph | Есть конкретные инженерные decks и требования к relationship semantics |
| Стратегия и продукт | Wardley, story map, Kanban | Пользовательский сценарий не закрывается текущими matrices/timeline/table |
| Новые количественные views | Radar, polar, bump, beeswarm, ridgeline, streamgraph | Есть подходящие данные и объяснимое преимущество над bar/line/table |
| Простые структуры | Nested, Venn | Требуется именно containment/overlap, а не декоративная раскладка |
| Отраслевые presets | IT current-state, high-level, medallion, DP integration/security | Сначала examples и routing над общими контрактами; новый layout только при новом содержательном устройстве |
| Пространственные views | Exploded axonometric, axonometric plan | Подтверждён кейс продукта/помещения и понятна проверка editable geometry |

## Общий Definition of Done для каждого инкремента

- [ ] Реализован общий модуль; нет ветвлений по клиентскому deck, заголовку или slide number.
- [ ] Zod contract, валидные examples каждого variant, limits и pointer-aware diagnostics.
- [ ] Числа из данных определены единожды; все количественные claims имеют sources или маркировку illustrative. Агрегации прозрачны.
- [ ] Позитивные и негативные тесты проверяют данные и геометрию, включая нули, missing, большие диапазоны и длинные подписи.
- [ ] Общий layout harness проходит во всех темах. Проверены RU/EN и заявленные форматы; подписи проектных архитектурных diagrams — English.
- [ ] HTML и native PPTX берут одну Scene geometry. Есть XML-проверка objects/text/custom geometry и отсутствие случайного flattening всего exhibit в изображение.
- [ ] Измерения сдвинутых подписей не меняют data marks; изменение темы не меняет значения и отношения размеров.
- [ ] Пройдена визуальная приёмка по дизайн-спецификации: иерархия, читаемость в режиме показа/чтения, композиция, аккуратность и соответствие теме. Ручная правка native objects проверена в PowerPoint.
- [ ] Просмотрены previews, выполнен `sc check`, затем `sc visual-qa` с actual Office render и Chrome, findings записаны штатным механизмом. Повторяющиеся дефекты исправлены в shared modules; изменения QA отражены в `REVIEW-LOG.md`.
- [ ] При отсутствии PowerPoint явно указан LibreOffice renderer и ограничения сравнения. Если visual QA технически недоступна, это записано; PNG из Scene не названы доказательством Office fidelity.
- [ ] Обновлены общие инструкции выбора exhibits и workflow, docs и provenance при переносе материала.
- [ ] Для реализации выполнены `npm run check`, `npm run gen` после library/CLI изменений и `npm run build`; staged paths перечислены явно.

Калибровку `office-rules.gen.ts` не менять вручную. При материальном изменении text rendering/export применять установленный probe/corpus workflow на реальном Office; запуск новой диаграммы сам по себе не повод менять измеренные правила. [AGENTS.md](../../AGENTS.md) · [Add layout](../how-to/add-layout.md) · [Visual QA](../how-to/visual-qa.md).

## Первый конкретный engineering шаг

Начать с визуального эталона **heatmap** в светлой и тёмной темах, затем реализовать его как пользовательскую возможность. Отдельная ограниченная задача — **воспроизведение/исправление Path opacity** как общий технический долг. Далее paired comparisons, fishbone и treemap с той же визуальной приёмкой. Graph router и architecture delta вести отдельными небольшими инкрементами, чтобы они не задерживали всю первую группу.

Checklist выше сохранён как исходный план и критерии приёмки, а не текущий трекер. Код, схемы, документация, примеры и сайт входят в релиз 0.8.0. Не все критерии визуальной приёмки закрыты: ограничения и доказательства приведены в [отчёте о реализации](diagram-design-implementation-2026-10.md).
