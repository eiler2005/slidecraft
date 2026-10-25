# Реализация диаграмм SlideCraft

> 25 октября 2026 · Development repository, без npm-релиза · [Research](diagram-design-review-2026-10.md) · [Исходный план](diagram-design-adoption-plan-2026-10.md) · [Дизайн](diagram-design-visual-spec-2026-10.md)

## Что добавлено

Библиотека расширена с 46 до **73 layouts**. Все новые diagrams строятся общей Scene и экспортируются как редактируемые фигуры, линии, freeform paths и текст PowerPoint. Это не встроенные Office charts с таблицей данных. Геометрия используется также в HTML и векторном PDF.

| Группа плана | Реализованный результат |
|---|---|
| A: contracts и дизайн | ADR 0008, Zod contracts, limits, semantic routes, синтетические примеры и руководство |
| B1: количественная геометрия | Path opacity в SVG/PPTX/PDF, `ctx.path`, finite scales, deterministic squarify, ribbon geometry, independent area/height/thickness QA |
| B2: графы | Node/edge identities, endpoints, deterministic orthogonal routing, отдельные fan ports, обход посторонних узлов, миграция существующего `architecture` |
| C: первая группа | Heatmap, treemap, fishbone; dumbbell и slopegraph как варианты `chart-takeaway` |
| D: изменения и ответственность | Architecture delta с общей сеткой и вычисленным ledger; swimlane с owners и handoffs |
| E: потоки и слои | Трёхэтапный Sankey с балансом и общей шкалой; loop и layer-stack |
| F: опыт клиента | User journey с evidence и ordinal sentiment; service blueprint с линией видимости |
| G: технические diagrams и import | Flowchart, state-machine, sequence; ограниченный Mermaid/draw.io/Excalidraw import и loss ledger |
| H: модели и продукт | ER, database-schema, UML class, dependency-graph, Wardley, story-map, kanban, nested, Venn, security-matrix |
| H: графики и пространство | Radar, polar, exploded-axonometric, axonometric-plan; bump, ridgeline, streamgraph и beeswarm variants |

Итого: **27 новых layouts и 6 variants**. Режим `readability: present` повышает минимальные размеры шрифта и требует сокращать или разбивать переполненный контент. Темы и общий chrome сохраняют принадлежность диаграмм к презентации. [Актуальные контракты](../reference/layouts.gen.md) · [Руководство и ограничения](../how-to/create-diagrams.md).

## Источники и перенос

Внешний reference зафиксирован на commit `0b9b10cab3dbf695642fa1a6c4b4f60df9083689` репозитория cathrynlavery/diagram-design. Использованы требования, семантика и сценарии проверки из исследования; реализация TypeScript оригинальная. Upstream code, assets, fonts и тексты не включены. Происхождение отмечено в `NOTICE`. Все данные примеров синтетические, с источником `illustrative`; клиентские материалы не добавлялись.

## Проверка и визуальные исправления

- Общий layout harness проверяет новые примеры во всех семи темах; отдельные тесты проверяют сохранение площадей и толщин, баланс, маршрутизацию, ошибки contracts и импорт.
- Экспортный тест читает реальный PPTX ZIP: cubic freeform paths, alpha, отдельный редактируемый текст и отсутствие растрового exhibit. HTML проверяется на сохранение opacity; native PDF также собирается.
- Два публичных примера по 33 слайда: [Consulting Classic](../../examples/diagram-gallery/deck.yaml) и [Midnight](../../examples/diagram-gallery-midnight/deck.yaml). Просмотрены все 66 рендеров Chrome. На сайте представлены previews и скачиваемые PPTX, PDF и HTML.
- По просмотру исправлены общие правила: контраст текста на средних заливках, видимые наконечники loop, разнесение пространственных слоёв, внешние подписи Venn, шкала рангов bump и цветовые ключи streamgraph. Заголовки UML и sequence согласованы с фактически показанными данными.
- Итоговые команды: `npm run check`, `npm run gen`, `npm run build`, сборка сайта и обоих примеров. Подробности исправлений и воспроизводимые команды — в [REVIEW-LOG](../../examples/diagram-gallery/REVIEW-LOG.md).

## Что остаётся ограничением

**Actual Office render и ручное редактирование в PowerPoint не подтверждены.** Установленный PowerPoint не ответил на automation export (`-1712` / `-9074`); обычный quit также был отменён приложением. LibreOffice отсутствует. Принудительное завершение PowerPoint не выполнялось. Поэтому browser QA packs честно имеют `reference: none`, не содержат выдуманного parity score и не подтверждают 95% fidelity. Экспортная геометрия и XML проверены отдельно. Для завершения Office-приёмки нужно повторить `visual-qa` на работающем Office и проверить перемещение/правку native objects.

Router предназначен для небольших графов с явной сеткой. QA проверяет identities, endpoints, orthogonal routes и транзит через посторонние блоки; исчерпывающая оптимизация пересечений, общих трасс и port/container semantics не заявлена. PPTX paths не обещают автоматического переподключения к узлам при перетаскивании.

Sequence поддерживает ordered calls/returns/self-calls; fragments пока отклоняются. Импорт поддерживает ограниченный subset и заменяет исходные стили/координаты; ledger сообщает потери, ER optionality и relationship wording упрощаются явно. Deployment и отраслевые представления описаны как [patterns над общими layouts](../../library/references/diagram-patterns.md), без отдельного полного языка вложенных hosts. Spatial views — простые редактируемые схемы, не CAD.

Следовательно, код и документация плана внедрены в заявленных bounded contracts; открытые критерии Office-приёмки и дальнейшее расширение contracts не отмечены выполненными.
