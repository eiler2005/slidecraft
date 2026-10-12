/**
 * Cover art: a full-height panel on the right of the cover that carries the deck's topic.
 * Either a picture (`image`, or one generated from `imagePrompt` by `slidecraft images`) or a
 * motif drawn from native shapes in the theme accent — editable and recolourable in
 * PowerPoint, identical in every engine, no licences involved. The motif follows the topic:
 * `auto` reads the title, kicker and subtitle (English and Russian keywords).
 */
import { mix } from '../engine/color.ts';
import type { Box } from '../engine/scene.ts';
import type { ComposeContext } from './types.ts';

export const COVER_ART = ['network', 'growth', 'flow', 'orbit', 'grid', 'layers'] as const;
export type CoverArt = (typeof COVER_ART)[number];

/** Topic words per motif; stems so that Russian inflections match too. */
const TOPICS: Record<CoverArt, string[]> = {
  network: [
    'ai',
    'ии',
    'artificial',
    'data',
    'данн',
    'platform',
    'платформ',
    'digital',
    'цифров',
    'network',
    'сет',
    'cloud',
    'облак',
    'model',
    'модел',
    'software',
    'engineer',
    'инженер',
    'tech',
    'технолог',
    'agent',
    'агент',
    'automat',
    'автомат',
  ],
  growth: [
    'growth',
    'grow',
    'рост',
    'revenue',
    'выручк',
    'market',
    'рын',
    'invest',
    'инвест',
    'profit',
    'прибыл',
    'sales',
    'продаж',
    'scale',
    'масштаб',
    'financ',
    'финанс',
    'price',
    'цен',
    'ruble',
    'рубл',
    'fund',
    'фонд',
    'seed',
    'raise',
  ],
  flow: [
    'process',
    'процесс',
    'journey',
    'путь',
    'transform',
    'трансформ',
    'roadmap',
    'plan',
    'план',
    'step',
    'шаг',
    'pilot',
    'пилот',
    'deploy',
    'внедр',
    'launch',
    'запуск',
    'trip',
    'путешеств',
    'kickoff',
    'migrat',
    'миграц',
  ],
  orbit: [
    'customer',
    'клиент',
    'ecosystem',
    'экосистем',
    'partner',
    'партн',
    'community',
    'сообществ',
    'user',
    'пользоват',
    'people',
    'люд',
    'team',
    'команд',
    'talent',
    'hiring',
    'найм',
  ],
  layers: [
    'architecture',
    'архитектур',
    'stack',
    'стек',
    'security',
    'безопасн',
    'infrastructure',
    'инфраструктур',
    'system',
    'систем',
    'layer',
    'уров',
    'risk',
    'риск',
    'compliance',
  ],
  grid: [
    'product',
    'продукт',
    'portfolio',
    'портфел',
    'operations',
    'операц',
    'program',
    'программ',
    'structure',
    'структур',
    'update',
    'review',
    'обзор',
    'quarter',
    'квартал',
  ],
};

/** The motif whose topic words the text mentions most; ties and no match fall back by hash. */
export function pickCoverArt(text: string): CoverArt {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  let best: CoverArt | undefined;
  let bestScore = 0;
  for (const art of COVER_ART) {
    const score = words.filter((w) =>
      TOPICS[art].some((stem) => (stem.length <= 3 ? w === stem : w.startsWith(stem))),
    ).length;
    if (score > bestScore) {
      best = art;
      bestScore = score;
    }
  }
  return best ?? COVER_ART[hash(text) % COVER_ART.length]!;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic generator, so the same title always draws the same art. */
function random(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLE = 'cover-art';

/** Draw the panel and its motif. `seed` (the title) varies the details, not the motif. */
export function drawCoverArt(ctx: ComposeContext, panel: Box, art: CoverArt, seed: string) {
  const accent = ctx.colors.accent;
  const tint = (k: number) => mix(accent, '#FFFFFF', k);
  const shade = (k: number) => mix(accent, '#000000', k);
  const rnd = random(`${art}:${seed}`);
  const P = panel;
  const role = { role: ROLE };
  ctx.rect(P, { fill: accent, ...role });
  const inner: Box = { x: P.x + 0.45, y: P.y + 0.7, w: P.w - 0.9, h: P.h - 1.4 };

  switch (art) {
    case 'network': {
      const cols = 4;
      const rows = 6;
      const cw = inner.w / cols;
      const rh = inner.h / rows;
      // one node per cell, jittered inside it: an organic mesh with no straight outline
      const nodes: [number, number, number][] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (rnd() < 0.18) continue;
          nodes.push([
            inner.x + (c + 0.5 + (rnd() - 0.5) * 0.8) * cw,
            inner.y + (r + 0.5 + (rnd() - 0.5) * 0.8) * rh,
            0.05 + rnd() * 0.08,
          ]);
        }
      const seen = new Set<string>();
      nodes.forEach(([x, y], i) => {
        const near = nodes
          .map((n, j) => ({ j, d: Math.hypot(n[0] - x, n[1] - y) }))
          .filter((n) => n.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        for (const { j } of near) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) continue;
          seen.add(key);
          ctx.line(x, y, nodes[j]![0], nodes[j]![1], { color: tint(0.45), width: 1.25 }, role);
        }
      });
      const third = Math.floor(nodes.length / 3);
      const hubs = new Set([Math.floor(rnd() * third) + 1, Math.floor(rnd() * third) + 2 * third]);
      nodes.forEach(([x, y, r], i) => {
        if (hubs.has(i)) {
          const R = 0.34;
          ctx.ellipse(
            { x: x - R, y: y - R, w: 2 * R, h: 2 * R },
            { stroke: { color: tint(0.7), width: 1.25 }, ...role },
          );
          ctx.ellipse({ x: x - 0.17, y: y - 0.17, w: 0.34, h: 0.34 }, { fill: '#FFFFFF', ...role });
        } else
          ctx.ellipse({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { fill: tint(0.6), ...role });
      });
      break;
    }
    case 'growth': {
      const n = 6;
      const slot = inner.w / n;
      const bw = slot * 0.62;
      const base = inner.y + inner.h;
      const tops: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const h = inner.h * (0.16 + (0.56 * i) / (n - 1) + (rnd() - 0.5) * 0.08);
        const x = inner.x + i * slot + (slot - bw) / 2;
        ctx.rect(
          { x, y: base - h, w: bw, h },
          { fill: i === n - 1 ? '#FFFFFF' : tint(0.55 - i * 0.07), ...role },
        );
        tops.push([x + bw / 2, base - h - 0.35]);
      }
      tops.forEach(([x, y], i) => {
        const next = tops[i + 1];
        if (next)
          ctx.line(
            x,
            y,
            next[0],
            next[1],
            { color: '#FFFFFF', width: 2.25 },
            { ...role, arrowEnd: i === tops.length - 2 },
          );
      });
      break;
    }
    case 'flow': {
      const n = 5;
      const gap = 0.12;
      const h = (inner.h - gap * (n - 1)) / n;
      const d = Math.min(0.55, h * 0.45);
      const w = inner.w * 0.78;
      for (let i = 0; i < n; i++) {
        const x = inner.x + (inner.w - w) / 2 + (i % 2 ? 0.18 : -0.18) * (rnd() + 0.5);
        const y = inner.y + i * (h + gap);
        const fill = i === n - 2 ? '#FFFFFF' : tint(0.25 + i * 0.1);
        ctx.polygon(
          [
            [x, y],
            [x + w / 2, y + d],
            [x + w, y],
            [x + w, y + h - d],
            [x + w / 2, y + h],
            [x, y + h - d],
          ],
          { fill, ...role },
        );
      }
      break;
    }
    case 'orbit': {
      const cx = P.x + P.w / 2;
      const cy = inner.y + inner.h * 0.55;
      const maxR = Math.min(P.w / 2 - 0.25, inner.h / 2);
      const rings = 4;
      for (let i = rings; i >= 1; i--) {
        const r = (maxR * i) / rings;
        ctx.ellipse(
          { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
          { stroke: { color: tint(0.35 + i * 0.08), width: 1.25 }, ...role },
        );
      }
      ctx.ellipse(
        { x: cx - maxR * 0.16, y: cy - maxR * 0.16, w: maxR * 0.32, h: maxR * 0.32 },
        { fill: '#FFFFFF', ...role },
      );
      for (let i = 1; i <= rings; i++) {
        const r = (maxR * i) / rings;
        const a = rnd() * Math.PI * 2;
        const s = i === rings - 1 ? 0.16 : 0.09;
        ctx.ellipse(
          { x: cx + r * Math.cos(a) - s, y: cy + r * Math.sin(a) - s, w: 2 * s, h: 2 * s },
          { fill: i === rings - 1 ? '#FFFFFF' : tint(0.6), ...role },
        );
      }
      break;
    }
    case 'grid': {
      const cols = 4;
      const gap = 0.12;
      const s = (inner.w - gap * (cols - 1)) / cols;
      const rows = Math.floor((inner.h + gap) / (s + gap));
      const y0 = inner.y + (inner.h - (rows * (s + gap) - gap)) / 2;
      const lit = Math.floor(rnd() * rows * cols);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c;
          const v = rnd();
          if (k !== lit && v < 0.22) continue;
          ctx.rect(
            { x: inner.x + c * (s + gap), y: y0 + r * (s + gap), w: s, h: s },
            {
              fill:
                k === lit ? '#FFFFFF' : v < 0.55 ? tint(0.18) : v < 0.85 ? tint(0.38) : shade(0.18),
              radius: 0.05,
              ...role,
            },
          );
        }
      break;
    }
    case 'layers': {
      const n = 4;
      const cx = P.x + P.w / 2;
      const hw = Math.min(inner.w / 2, 1.7);
      const hh = hw * 0.5;
      const t = 0.16;
      const step = Math.min(0.95, (inner.h - 2 * hh - t) / (n - 1));
      const y0 = inner.y + (inner.h - (2 * hh + t + step * (n - 1))) / 2;
      for (let i = n - 1; i >= 0; i--) {
        const y = y0 + i * step; // top corner of the slab
        const top = i === 0 ? '#FFFFFF' : tint(0.2 + i * 0.12);
        ctx.polygon(
          [
            [cx - hw, y + hh],
            [cx, y + 2 * hh],
            [cx, y + 2 * hh + t],
            [cx - hw, y + hh + t],
          ],
          { fill: shade(0.12 + i * 0.03), ...role },
        );
        ctx.polygon(
          [
            [cx, y + 2 * hh],
            [cx + hw, y + hh],
            [cx + hw, y + hh + t],
            [cx, y + 2 * hh + t],
          ],
          { fill: shade(0.25 + i * 0.03), ...role },
        );
        ctx.polygon(
          [
            [cx, y],
            [cx + hw, y + hh],
            [cx, y + 2 * hh],
            [cx - hw, y + hh],
          ],
          { fill: top, ...role },
        );
      }
      break;
    }
  }
}
