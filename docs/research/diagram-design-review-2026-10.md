# Diagram Design: review и исследование для SlideCraft

> Дата: 24 октября 2026 · Статус: исследование, без реализации · [План внедрения](diagram-design-adoption-plan-2026-10.md)

## Вывод

Из `cathrynlavery/diagram-design` стоит перенять **правила построения и проверки диаграмм, несколько новых типов и отдельные варианты графиков**. Наибольшую пользу для SlideCraft дадут числовая heatmap, treemap, fishbone, dumbbell/slopegraph и architecture delta. Sankey тоже закрывает существенный пробел, но требует отдельной проверки геометрии потоков и экспорта кривых.

Основа интеграции — существующая цепочка SlideCraft: **контракт данных → layout → Scene IR → HTML/PDF/редактируемый PPTX**. Upstream предоставляет агенту инструкции, HTML/SVG-примеры и проверяющие скрипты. Это полезный источник требований и тестовых сценариев, но не готовый движок для PowerPoint. [Upstream skill][u-skill] · [Архитектура SlideCraft](../explanation/architecture.md).

Второй приоритет — swimlane, flowchart, sequence/state, loop, customer journey и service blueprint. Узкие технические нотации и пространственные axonometric-диаграммы разумно добавлять по подтверждённому запросу, после основных консультационных exhibits.

Адаптация внешнего вида к слайдам вынесена в [визуальную спецификацию PowerPoint](diagram-design-visual-spec-2026-10.md). Она задаёт конкретные композиции, читаемость, типографику и оформление приоритетных diagrams. Это дополнение к техническому сравнению: визуальные макеты ещё предстоит построить и проверить в Office.

## Что и как проверено

| Объект | Зафиксированная версия / метод |
|---|---|
| Upstream | Commit [`0b9b10cab3dbf695642fa1a6c4b4f60df9083689`](https://github.com/cathrynlavery/diagram-design/commit/0b9b10cab3dbf695642fa1a6c4b4f60df9083689), release commit `2.6.120`; просмотрено 24.10.2026 |
| SlideCraft | Локальный HEAD `bcd6a0e9eca2556a8f07fa558d727cc9a37d7f11`, package version `0.7.8`; рабочее дерево перед исследованием чистое |
| Каталог upstream | 45 visual types в таблице выбора `SKILL.md`; варианты графиков учтены отдельно |
| Каталог SlideCraft | 46 зарегистрированных layouts: сверены `src/layouts/index.ts` и вывод `node dist/slidecraft.mjs layouts --json` |
| Углублённое чтение | Контракты layouts, Scene, SVG/PPTX/PDF backends, scene QA, semantic routing; upstream type references, ADR, лицензии, импортер Mermaid и проверяющие скрипты |
| Визуальная выборка | Просмотрены опубликованные PNG Sankey, treemap, architecture delta, service blueprint из того же upstream commit |
| Граница проверки | Upstream-примеры заново не генерировались; upstream test suite и Office parity не запускались. Это source review и обзор образцов, без утверждения о готовности новых layouts |

Числа «45 типов» и «46 layouts» **не являются сравнением полноты**: у SlideCraft в счёт входят обложки, текст, summaries и canvas; у upstream один тип может содержать несколько разных графических вариантов. Источники инвентаризации: [upstream selection guide][u-skill], [локальный registry](../../src/layouts/index.ts), [контракты layouts](../reference/layouts.gen.md).

«Есть» ниже означает наличие специализированного нативного контракта для основного сценария. Возможность вручную нарисовать фигуру через `native-canvas` или HTML не считается готовым типом. «Частично» означает полезную основу с конкретным семантическим ограничением; это не заявление о полном совпадении возможностей.

## Review: что у проекта хорошо

| Находка | Польза для SlideCraft | Что уже имеется у нас |
|---|---|---|
| Выбор сначала по смыслу, затем по графической форме | Различать очередь, передачу ответственности, состояние и обычную последовательность | Уже есть `EXHIBITS` и `exhibit-selection.md`; расширять их, не создавать второй каталог |
| Отдельные semantic patterns | C4, RAG, governance, lifecycle могут быть примерами поверх общих layouts | Существуют purpose/useWhen/avoidWhen и композиция; не каждый отраслевой термин требует нового layout |
| Строгие правила соединений | Убирать неоднозначные точки входа, пересечения подписей, общие наложенные трассы | Текущий `architecture` соединяет границы блоков прямыми отрезками; полноценного общего router в нём нет |
| Проверяется соответствие картинки данным | Для Sankey — баланс и ширина; для treemap — доли площадей; для heatmap — шкала интенсивности | Общая QA уже проверяет текст, границы, контраст и плотность; нужны проверки смысла конкретных exhibits |
| Тесты намеренно испорченных примеров | Доказывать, что checker ловит неверные значения и неподдерживаемую геометрию, а не только принимает хороший образец | Дополнить существующий harness отрицательными тестами для новых геометрических правил |
| Architecture delta со стабильными ID | Объяснять миграцию без визуального «переезда» неизменённых компонентов | `before-after` содержит списки и метрики, а не две связанные топологии |
| Явные границы сложности | Превращать перегруженную схему в overview/detail с объяснением причины | Уже есть Zod limits и измерение текста; добавить лимиты графа, а не только строк |
| Импорт через извлечение смысла и отчёт о потерях | Переносить исходные связи и группировку в редактируемые объекты | У нас развит PPTX importer; специализированного diagram importer в проверенном `src/` не найдено |

Основания: [semantic patterns][u-patterns], [ADR о границах taxonomy][u-taxonomy], [geometry verifier][u-geometry], [Sankey verifier][u-sankey-check], [adversarial tests][u-sankey-tests], [архитектурный layout](../../src/layouts/architecture.ts), [общая QA](../../src/qa/scene-checks.ts), [semantic routes](../../src/library/exhibits.ts).

## Ограничения и идеи, которые нельзя переносить буквально

1. **HTML/SVG — не контракт редактируемого PPTX.** SVG-картинка на слайде не делает её блоки, подписи и связи отдельными объектами. Новые diagrams должны композироваться в Scene. Для графиков отдельно объявлять уровень редактируемости: native Office chart либо редактируемые shapes/text.
2. **Пиксельные рецепты рассчитаны на их canvas.** Сетка 4 px, конкретные размеры узлов и маленькие подписи не переносятся напрямую в наш `ctx.body`. Размеры выводятся из темы, формата и измеренного текста; геометрию, кодирующую величину, нельзя округлять ради сетки.
3. **Не вся их эстетика универсальна.** Обязательные шрифты, один editorial skin и фиксированное число акцентов нужно переводить в наши theme tokens. Цвет для идентичности серии и цвет для вывода — разные роли; доступность должна сохраняться без цвета.
4. **Ряд checkers привязан к SVG-разметке образцов.** Например, geometry checker распознаёт узлы и маски по размерам прямоугольников; Sankey checker принимает ограниченную грамматику путей. Для SlideCraft предпочтительнее типизированные роли и метаданные Scene. Их эвристики нельзя выдавать за универсальную верификацию произвольного SVG. [Geometry][u-geometry] · [Sankey checks][u-sankey-check].
5. **Часть правил нуждается в адаптации к доказательствам.** Fishbone reference требует выделить подтверждённую первопричину. В рабочем анализе она может быть неизвестна: наш контракт должен разрешать только гипотезы, с отдельным evidence status. Journey sentiment тоже требует источника исследования или явного обозначения гипотезы. [Fishbone][u-fishbone] · [Journey][u-journey].
6. **Ограничения импорта существенны.** Изученный Mermaid extractor поддерживает flowchart/graph, sequenceDiagram, stateDiagram-v2, erDiagram; это не поддержка всех Mermaid grammars. `classDiagram`, Gantt, Sankey и другие указаны как unsupported. Неподдерживаемое должно давать диагностику. [Extractor][u-mermaid].
7. **Не всё стоит дублировать.** Один акцент, ограничения вместимости, брендирование, visual QA и инвентарь layouts у нас уже существуют. Переносить нужно конкретные недостающие проверки и варианты, а не весь workflow. [Add layout](../how-to/add-layout.md) · [Visual QA](../how-to/visual-qa.md).

## Полная карта 45 типов

Названия и определения upstream — из [selection guide][u-skill] и [ADR о новых grammars][u-grammars]. Локальные соответствия проверены по registry и контрактам; решения в правом столбце — рекомендация этого исследования.

| № | Тип upstream | Статус в SlideCraft | Соответствие / пробел и решение |
|---|---|---|---|
| 1 | Architecture | Частично | `architecture/zones`: компоненты, связи, register уже есть. Расширить routing, порты и контейнеры |
| 2 | Architecture delta | Нет | Две синхронизированные топологии + реестр изменений; отдельный layout на общих primitives |
| 3 | IT current-state | Частично | `architecture`, `coverage-map`, `composition`; отраслевой preset после расширения графов |
| 4 | Flowchart | Нет | `process-steps` не моделирует ветвления и merge; нужен контракт graph + decision |
| 5 | Sequence | Нет | Нет actors/lifelines/messages/fragments; кандидат для технической волны |
| 6 | State machine | Нет | Нет states/transitions/guards и проверок terminal states |
| 7 | ER / data model | Нет | `data-table` не содержит связей сущностей и кардинальностей |
| 8 | Timeline | Есть | `timeline/milestones`; новый layout не нужен |
| 9 | Swimlane | Нет | `process-compare/lanes` — current/proposed, а не роли и handoffs |
| 10 | Quadrant | Есть | `matrix-2x2/plot,quadrants`; можно пополнять примеры |
| 11 | Radar / spider | Нет | Добавлять после основных сравнений; всегда предлагать bar/table как альтернативу |
| 12 | Polar / radial lollipop | Нет | Нишевые циклические данные; низкий приоритет |
| 13 | Loop / flywheel | Нет | Последовательные chevrons не показывают замыкание и накопление в hub |
| 14 | Nested | Нет | Нужен отдельный контракт containment; переиспользовать будущие group primitives |
| 15 | Tree | Есть | `issue-tree/issue,driver`; основной bounded tree имеется, traceable-block metadata можно расширить |
| 16 | Org chart | Есть | `org-chart/tree`; сложная матричная оргструктура остаётся отдельной задачей |
| 17 | Layer stack | Нет | `funnel/pyramid` кодирует другую структуру; полезный простой layout или компонент |
| 18 | Exploded axonometric | Нет | Специализированная геометрия разнесённых частей; отложить до предметного кейса |
| 19 | Axonometric plan | Нет | Пространственное размещение на плане; отложить до предметного кейса |
| 20 | Venn | Нет | Добавить только если важны пересечения множеств; не обещать площади пропорционально данным |
| 21 | Pyramid / funnel | Есть | `funnel/funnel,pyramid` |
| 22 | Bar / column | Есть | `chart-takeaway/bar,column`; dumbbell отсутствует, см. варианты ниже |
| 23 | Waterfall | Есть | `waterfall/full,with-takeaway`; повторно реализовывать не нужно |
| 24 | Treemap | Нет | `marimekko` не заменяет разбиение площади на доли; высокий приоритет |
| 25 | Heatmap | Нет | `risk-matrix` — только вероятность × влияние; нужна произвольная числовая матрица |
| 26 | Line | Есть | `chart-takeaway/line`; slopegraph, bump и distribution-варианты отсутствуют |
| 27 | Gantt | Есть | `timeline/gantt`; новый layout не нужен |
| 28 | Scatter | Есть | `bubble-chart/scatter,bubble,portfolio`; beeswarm отсутствует |
| 29 | High-Level | Частично | `architecture`/`composition` показывают базовый stack; container topology требует расширений |
| 30 | Process | Частично | `process-steps` покрывает последовательность; роли и payload handoffs требуют нового контракта |
| 31 | Medallion | Частично | Зоны позволяют показать уровни; quality/access semantics оформить как preset, не отдельный engine |
| 32 | Data flow | Частично | `architecture` даёт nodes/links; queue, capacity, role-scoped stages пока не представлены |
| 33 | DP integration | Частично | Источники → core → consumers выражаются зонами; группировка и routing ограничены |
| 34 | DP security matrix | Нет | RACI описывает ответственность, не permissions; начать с table preset с явной семантикой доступа |
| 35 | Sankey | Нет | Нужны количественные ribbons и conservation checks; высокий эффект, высокая сложность |
| 36 | Fishbone / Ishikawa | Нет | `issue-tree` полезен для причин, но не даёт fishbone grammar; хороший ранний кандидат |
| 37 | Wardley map | Нет | `matrix-2x2` не имеет evolution bands + dependency chain; следующая стратегическая волна |
| 38 | Kanban | Нет | Нужны колонки состояний, карточки и WIP; для презентаций статический snapshot |
| 39 | User journey | Нет | Нет согласованной stage grid с sentiment и touchpoints; не путать с названием use case у process |
| 40 | Service blueprint | Нет | Нет customer/frontstage/backstage и line of visibility; отдельный кандидат для operating-model decks |
| 41 | Deployment | Частично | `architecture/zones` передаёт базовую топологию; hosts/artifacts/replicas/ports отсутствуют |
| 42 | Dependency graph | Частично | Links в `architecture` могут соединять общие узлы; нет специализированной раскладки DAG/cycles |
| 43 | UML class | Нет | Нет compartments/operations и типизированных relationship heads |
| 44 | Story map | Нет | Нет narrative backbone × release slices; отдельный product-planning layout |
| 45 | Database schema | Нет | Нет column-to-column FK anchors, SQL types и constraint/index compartments |

Сводка этой классификации: **10 типов покрывают основной сценарий, 9 имеют частичную основу, 26 не имеют специализированного контракта**. Это не backlog из 26 обязательных layouts: часть позиций должна стать presets, часть не нужна без конкретного спроса.

### Варианты, которые теряются при сравнении только названий

| Вариант upstream | Что у нас | Рекомендация |
|---|---|---|
| Dumbbell в Bar | Нет двух связанных точек на общей шкале по каждой категории | Вариант `chart-takeaway`; высокий приоритет для план/факт, до/после, benchmark |
| Slopegraph в Line | Обычный line есть; нет двух осей с прямыми endpoint labels | Вариант `chart-takeaway`; общий контракт paired comparisons с dumbbell |
| Bump в Line | Нет специализированной rank geometry | Позднее: изменение мест, ties и отсутствующие наблюдения должны быть определены |
| Ridgeline в Line | Нет distribution geometry | Отложить: требует bins/density semantics, не только нового оформления |
| Streamgraph в Line | Нет centered stacked-area geometry | Низкий приоритет: часто хуже обычного stacked chart для делового сравнения |
| Beeswarm в Scatter | Scatter есть, collision-free packing нет | Позднее, если нужны индивидуальные наблюдения и распределения |
| Marimekko в Treemap | Уже есть `marimekko/shares` | Переиспользовать; взять дополнительные идеи QA площадей |

Источники: [Bar/dumbbell][u-bar], [Line variants][u-line], [Treemap/Marimekko][u-treemap], [upstream guide][u-skill], [chart-takeaway](../../src/layouts/chart-takeaway.ts), [bubble-chart](../../src/layouts/bubble-chart.ts), [marimekko](../../src/layouts/marimekko.ts).

## Рекомендуемый набор и порядок

Оценки сложности — сравнительные инженерные суждения по текущему коду, не оценки сроков и не измерения спроса. **S**: локальная геометрия; **M**: новый контракт и алгоритм с QA; **L**: графовая семантика либо несколько зависимых изменений. Для всех нужны экспортные проверки.

| Приоритет | Возможность | Зачем клиентскому deck | Сложность / зависимость |
|---|---|---|---|
| P0 | Connector metadata/router и проверки соединений | Читаемые архитектуры и процессы уже сегодня | L; общее основание графовых layouts |
| P0 | Path opacity parity | Полупрозрачные кривые выглядят одинаково в экспортных форматах | M; до Sankey, см. находку ниже |
| P1 | Числовая heatmap | Cohorts, KPI по подразделениям, сравнительные оценки | M; scale/missing values/контраст |
| P1 | Dumbbell + slopegraph | Изменение нескольких показателей на одной основе | M; общий paired-data helper и разведение подписей |
| P1 | Fishbone | Причины проблем, post-mortem, гипотезы улучшений | S–M; evidence status и text fit |
| P1 | Treemap | Структура затрат, выручки, портфеля | M; deterministic squarify и area checks |
| P1 | Architecture delta | Миграция, консолидация систем, целевая архитектура | L; shared graph model и стабильная раскладка |
| P2 | Swimlane | Handoffs между командами и зоны ответственности | M–L; graph routing |
| P2 | Sankey | Распределение затрат, объёмов и потерь со splits/merges | L; balance, width, Bézier и opacity |
| P2 | Loop / flywheel; layer stack | Механизм роста и уровни архитектуры/контролей | M; отдельная семантика цикла и уровней |
| P2 | User journey + service blueprint | Связать клиентскую проблему с внутренней операцией | M; shared stage-grid primitives, разные contracts |
| P2 | Flowchart, sequence, state | Решения, взаимодействия и lifecycle | L; разные semantic validators поверх общей геометрии |
| P3 | Остальные отсутствующие types/variants | Расширение по реальным пользовательским примерам | После проверки спроса и качества ранних волн |

Рекомендуемый первый пользовательский пакет: **heatmap, fishbone, treemap и два paired-comparison variants**. Architecture delta — следующий самостоятельный инкремент после router. Это уменьшает число зависимостей первого выпуска, сохраняя приоритет самого delta-сценария. Детальная последовательность — в [плане](diagram-design-adoption-plan-2026-10.md).

## Технические находки в SlideCraft

### F1. Кривые уже существуют, но прозрачность PathNode не доходит до основных exporters

В [Scene](../../src/engine/scene.ts) есть `PathNode` с M/L/C/Z-сегментами и `fillOpacity`. [PPTX backend](../../src/backends/pptxgenjs.ts) экспортирует C-сегменты как editable `custGeom`, поэтому новый формат Scene для самой формы Sankey не нужен.

Однако текущие ветки `case 'path'` в [SVG](../../src/backends/svg.ts), [PPTX](../../src/backends/pptxgenjs.ts) и [native PDF](../../src/backends/native-pdf.ts) передают fill, но не используют `n.fillOpacity`. Соседние ветки rect/polygon это поле используют. Это конкретный пробел обработки свойства, подтверждённый статическим чтением. Масштаб его визуального влияния нужно подтвердить минимальным экспортным fixture; в рамках этого review исправление не делалось.

У `ComposeContext` есть `add(SceneNode)` и `icon()`, но нет универсального `path()` helper. Удобный общий helper может уменьшить ручную работу с bounds и pointers; это предложение, а не обязательная переделка IR. [Context contract](../../src/layouts/types.ts).

### F2. Соединения нужно отличать от линий графиков

`LineNode` содержит координаты, stroke, arrowEnd и role, но не endpoint IDs. `architecture` проверяет наличие endpoint ID в content, затем выводит обычную линию. Геометрической QA не хватает устойчивой связи «ребро → порт → узел» для routing и проверки транзита через чужой блок. [Scene](../../src/engine/scene.ts) · [Architecture](../../src/layouts/architecture.ts).

Расширение должно быть общим и обратно совместимым. Проверки orthogonal routing применяются к graph connectors, но не к slopegraph, fishbone bones, Sankey ribbons и sentiment curves. Upstream тоже документирует исключения по смыслу элемента. [ADR][u-grammars].

### F3. QA уже сильнее, чем следует из простого списка типов

В `checkScene` уже есть проверки границ слайда, пересечений текста, текста под позднее нарисованной непрозрачной фигурой, выхода за панель, контраста и плотности. Переписывать их ради upstream checker не требуется. Нужны дополнительные проверки edges/ports/labels и количественных invariants. [Scene checks](../../src/qa/scene-checks.ts).

`tests/architecture-diagrams.test.ts` проверяет статические архитектурные картинки документации. Этот файл сам по себе не доказывает покрытие нативного `architecture` layout. Новые generic regressions должны проверять реальные Scene и экспортируемые объекты. [Тест](../../tests/architecture-diagrams.test.ts).

### F4. У нас уже есть место для semantic patterns

`src/library/exhibits.ts` задаёт relationship → layouts → guard; `composition` размещает существующие компоненты в ограниченных регионах. Поэтому data-platform, governance, C4/RAG и medallion лучше сначала рассматривать как маршруты и примеры над общими контрактами. Новый layout оправдан, когда меняется геометрическая или содержательная структура, как у sequence или Sankey. [Routes](../../src/library/exhibits.ts) · [Composition](../../src/layouts/composition.ts) · [Upstream taxonomy ADR][u-taxonomy].

## Что видно на опубликованных образцах

Это визуальные наблюдения по четырём PNG; не результаты повторного рендера и не оценка всей библиотеки.

| Образец | Сильная сторона | Что адаптировать к deck |
|---|---|---|
| [Sankey][u-img-sankey] | Один акцентный маршрут хорошо отделён от остальных; значения подписаны | Подписи среднего столбца требуют точного fit; сохранить объём и читаемость маленьких потоков |
| [Treemap][u-img-treemap] | Главная доля сразу видна; маленький элемент вынесен в пояснение | Источник внизу плотный; для слайда измерять и переносить текст средствами SlideCraft |
| [Architecture delta][u-img-delta] | Сопоставимые позиции и реестр изменений облегчают сравнение; статусы читаются без одного только цвета | Три панели конкурируют за ширину; часть деталей переносить на следующий слайд по явному правилу |
| [Service blueprint][u-img-blueprint] | Видимая граница frontstage/backstage и один проблемный cell | Много строк быстро уменьшает текст; вместимость определять по теме и title/source frame |

## Что именно можно перенять

| Способ | Рекомендация |
|---|---|
| Перенять идею и реализовать в TypeScript/Scene | Основной путь: geometry rules, invariants, type-selection criteria, негативные сценарии QA |
| Адаптировать фрагмент исходного кода или текста | Точечно, с указанием файла, commit, изменений и сохранением MIT notice; не маскировать происхождение |
| Перенести все HTML examples и Python verifiers | Не включать в runtime SlideCraft: другой контракт, размеры и дополнительный путь поддержки |
| Использовать HTML/SVG в research | Удобно как reference; готовность нативного PPTX этим не подтверждается |
| Использовать брендовые assets и шрифты upstream | Не требуется: наши themes, fonts и Tabler pipeline уже решают задачу |

Upstream `LICENSE` содержит MIT и copyright Cathryn Lavery, 2025; для копий или существенных частей требуется сохранять copyright и permission notice. `THIRD_PARTY_LICENSES.md` отдельно перечисляет лицензии и происхождение иконок/логотипов. При реальном переносе файлов нужно записать происхождение в наш `NOTICE` и сохранить применимый текст лицензии; одним переименованием лицензии всего проекта происхождение не заменяется. Сейчас сторонний runtime, код или assets в SlideCraft не добавлялись. [LICENSE][u-license] · [Third-party notices][u-third-party] · [Наш NOTICE](../../NOTICE).

## Неопределённости для следующего этапа

- Приоритеты основаны на назначении SlideCraft и пробелах контрактов. Частота запросов пользователей и экономический эффект не измерялись.
- Не проверена Office fidelity новых геометрий: их пока нет в нашей библиотеке. Особенно важны прозрачность, стрелки, замкнутые кривые, порядок рисования и длинные русские подписи.
- Для architecture delta надо решить, какие атрибуты входят в semantic signature и считается ли перемещение частью исходных данных или результатом layout. Автоматическое изменение раскладки не должно становиться ложным изменением системы.
- Для импортов нужен отдельный scope: поддержанные grammars, отчёт потерь, пределы входа и редакторский redesign. Их не стоит прятать внутрь первого выпуска диаграмм.
- Существующий [ROADMAP](../../ROADMAP.md) имеет собственные приоритеты v0.8. Этот документ предлагает отдельный backlog и не меняет обещанный release scope.

## Источники

Все upstream-ссылки ниже закреплены на проверенном commit. Локальные ссылки относятся к зафиксированному HEAD; будущие изменения могут сделать сравнение устаревшим.

- [Выбор типов и workflow][u-skill]; [семантические patterns][u-patterns]; [taxonomy ADR][u-taxonomy]; [новые layout grammars][u-grammars].
- [Sankey][u-sankey], [treemap][u-treemap], [heatmap][u-heatmap], [fishbone][u-fishbone], [architecture delta][u-delta], [journey][u-journey], [service blueprint][u-blueprint], [line variants][u-line], [bar/dumbbell][u-bar].
- [Geometry verifier][u-geometry], [Sankey verifier][u-sankey-check], [его adversarial tests][u-sankey-tests], [Mermaid extractor][u-mermaid], [packaged self-check][u-self-check].
- [MIT license][u-license], [third-party notices][u-third-party].

[u-skill]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/SKILL.md
[u-patterns]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/semantic-patterns.md
[u-taxonomy]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/adr/0002-semantic-patterns-do-not-expand-the-taxonomy.md
[u-grammars]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/adr/0007-new-layout-grammars.md
[u-sankey]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-sankey.md
[u-treemap]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-treemap.md
[u-heatmap]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-heatmap.md
[u-fishbone]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-fishbone.md
[u-delta]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-architecture-delta.md
[u-journey]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-journey.md
[u-blueprint]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-service-blueprint.md
[u-line]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-line.md
[u-bar]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/references/type-bar.md
[u-geometry]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/scripts/verify-geometry.py
[u-sankey-check]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/scripts/verify-sankey.py
[u-sankey-tests]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/scripts/test-verify-sankey.py
[u-mermaid]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/scripts/mermaid_extract.py
[u-self-check]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/skills/diagram-design/scripts/self_check.py
[u-license]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/LICENSE
[u-third-party]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/THIRD_PARTY_LICENSES.md
[u-img-sankey]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/screenshots/sankey.png
[u-img-treemap]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/screenshots/treemap.png
[u-img-delta]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/screenshots/architecture-delta.png
[u-img-blueprint]: https://github.com/cathrynlavery/diagram-design/blob/0b9b10cab3dbf695642fa1a6c4b4f60df9083689/docs/screenshots/service-blueprint.png
