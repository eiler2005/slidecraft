import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDeck } from '../src/engine/compose.ts';
import { checkScene } from '../src/qa/scene-checks.ts';
import { Deck, Slide } from '../src/spec/deck.ts';

describe('scene checks', () => {
  it('flags text hidden under an opaque shape drawn after it (SC-GEOM-004)', () => {
    const raw = {
      id: 'k',
      layout: 'kpi-tiles',
      title: 'Labels on KPI cards must stay visible above the card background',
      source: 'Test',
      tiles: [
        { value: '32', label: 'Slide layouts' },
        { value: '14', label: 'Storylines' },
      ],
    };
    const deck = Deck.parse({ schemaVersion: 1, id: 't', title: 'T', slides: [raw] });
    const { scene } = composeDeck({
      deck,
      slides: [Slide.parse(raw) as never],
      path: '/tmp/t.yaml',
      baseDir: '/tmp',
      diagnostics: [],
    });
    expect(checkScene(scene).filter((d) => d.code === 'SC-GEOM-004')).toEqual([]);
    // move a card after the labels: the label underneath becomes invisible
    const nodes = scene.slides[0]!.nodes;
    const card = nodes.findIndex((n) => n.kind === 'rect' && n.role === 'card');
    nodes.push(nodes.splice(card, 1)[0]!);
    expect(checkScene(scene).map((d) => d.code)).toContain('SC-GEOM-004');
  });
});

describe('new: a goal sentence becomes the deck id', () => {
  it('drops filler words and transliterates Cyrillic', async () => {
    const { slugFrom } = await import('../src/cli/commands.ts');
    expect(slugFrom('The board should approve a partner-led entry into Germany')).toBe(
      'board-approve-partner-led-entry-germany',
    );
    expect(slugFrom('Q3 steerco update for the ERP programme')).toBe(
      'q3-steerco-update-erp-programme',
    );
    expect(slugFrom('Совет директоров утверждает выход в Германию')).toBe(
      'sovet-direktorov-utverzhdaet-vykhod-germaniyu',
    );
  });
});

describe('cross-slide consistency (SC-CONSIST-001)', () => {
  it('does not mistake freeform CSS percentages for business metrics', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const d = checkConsistency([
      { id: 'one', html: '<style>.card{width:20%}</style><div>Revenue is 10%</div>' },
      { id: 'two', html: '<style>.card{width:10%}</style><div>Revenue is 10%</div>' },
    ]);
    expect(d).toEqual([]);
  });

  it('flags one metric shown with two values, and accepts rounding', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const slides = [
      { id: 'summary', title: 'Germany adds €40M revenue by 2028 on a partner-led entry' },
      { id: 'value', tiles: [{ value: '€42M', label: 'Germany revenue by 2028' }] },
      { id: 'plan', title: 'The plan delivers €40.2M revenue by 2028 with two partners' },
      { id: 'speed', title: 'Partners cut time to first revenue from 18 to 7 months' },
    ];
    const d = checkConsistency(slides);
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('€42M on value');
    expect(d[0]!.message).toContain('€40M on summary');
  });

  it('finds no contradictions in the example decks', async () => {
    const { checkDeck } = await import('../src/build.ts');
    const { existsSync, readdirSync } = await import('node:fs');
    const root = join(import.meta.dirname, '../examples');
    for (const dir of readdirSync(root).filter((d) => existsSync(join(root, d, 'deck.yaml')))) {
      const r = checkDeck(join(import.meta.dirname, '../examples', dir, 'deck.yaml'));
      expect(
        r.diagnostics
          .filter((x) => x.code.startsWith('SC-CONSIST-'))
          .map((x) => `${dir}: ${x.message}`),
      ).toEqual([]);
    }
  });
});

describe('totals, periods and units (SC-CONSIST-002/003)', () => {
  it('flags a total row, a total column, a Total category and a waterfall that do not add up', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const d = checkConsistency([
      {
        id: 'budget',
        header: ['Item', 'Q1', 'Q2', 'Total'],
        rows: [
          ['People', '€1.2M', '€1.3M', '€2.5M'],
          ['Cloud', '€0.4M', '€0.5M', '€1.2M'],
          ['Total', '€1.6M', '€2.3M', '€3.7M'],
        ],
      },
      {
        id: 'mix',
        chart: {
          type: 'column',
          categories: ['A', 'B', 'Total'],
          series: [{ name: 'Sales', values: [10, 20, 31] }],
        },
      },
      {
        id: 'bridge',
        chart: {
          type: 'waterfall',
          categories: ['2025', 'Price', 'Volume', '2026'],
          series: [{ name: 'Revenue', values: [100, 8, -3, 104] }],
          highlight: [0, 3],
        },
      },
    ]);
    const msgs = d
      .filter((x) => x.code === 'SC-CONSIST-002')
      .map((x) => `${x.slide}: ${x.message}`);
    expect(msgs).toHaveLength(5);
    expect(msgs.join('\n')).toContain('Cloud, Total column');
    expect(msgs.join('\n')).toContain('Total row, Q2');
    expect(msgs.join('\n')).toContain('"Total" of Sales');
    expect(msgs.join('\n')).toContain('waterfall "2026"');
  });

  it('accepts totals within rounding, subtotals, shares and rates', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const d = checkConsistency([
      {
        id: 't',
        header: ['Segment', 'Revenue', 'Share', 'Growth'],
        rows: [
          ['Retail', '€1.24M', '41%', '12%'],
          ['SME', '€1.13M', '38%', '8%'],
          ['Corporate', '€0.64M', '21%', '-3%'],
          ['Total', '€3.0M', '100%', '7%'],
        ],
      },
      {
        id: 'w',
        chart: {
          type: 'waterfall',
          categories: ['Start', 'Up', 'End'],
          series: [{ name: 'x', values: [12, 3, 15] }],
          highlight: [0, 2],
        },
      },
    ]);
    expect(d.filter((x) => x.code === 'SC-CONSIST-002')).toEqual([]);
  });

  it('flags one figure labelled with two periods or two currencies', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const d = checkConsistency([
      { id: 'a', title: 'The entry adds €40M Germany revenue in 2027 with partners' },
      { id: 'b', tiles: [{ value: '€40M', label: 'Germany revenue 2028' }] },
      { id: 'c', title: 'Cloud savings of $12M cost in the first year' },
      { id: 'd', title: 'We keep €12M cost savings in the first year' },
    ]);
    const msgs = d.filter((x) => x.code === 'SC-CONSIST-003').map((x) => x.message);
    expect(msgs.some((m) => m.includes('period 2027 on a, 2028 on b'))).toBe(true);
    expect(msgs.some((m) => m.includes('unit $ on c, € on d'))).toBe(true);
  });
});

describe('contrast background lookup', () => {
  it('sees polygon and ellipse fills under text, not only rectangles', async () => {
    const { bgAt } = await import('../src/qa/scene-checks.ts');
    const nodes = [
      {
        kind: 'polygon',
        points: [
          [0, 0],
          [2, 0],
          [2.5, 0.5],
          [2, 1],
          [0, 1],
        ],
        fill: '#1F5FBF',
      },
      { kind: 'ellipse', box: { x: 3, y: 0, w: 1, h: 1 }, fill: '#AA0000' },
    ] as never[];
    expect(bgAt(nodes, 2, 1, 0.5, '#FFFFFF')).toBe('#1F5FBF');
    expect(bgAt(nodes, 2, 3.5, 0.5, '#FFFFFF')).toBe('#AA0000');
    expect(bgAt(nodes, 2, 3.05, 0.05, '#FFFFFF')).toBe('#FFFFFF');
  });
});
