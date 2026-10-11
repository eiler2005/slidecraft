/**
 * Template ranking: brief → storyline × theme options.
 * Deterministic and explainable — every score comes with the words that produced it,
 * so the agent can tell the user *why* an option was suggested.
 */
import type { Brief } from '../spec/brief.ts';
import type { Storyline } from '../spec/storyline.ts';
import type { Theme } from '../spec/theme.ts';
import { loadStorylines, loadThemes } from './load.ts';

const STOP = new Set(
  'a an and are as at be by for from has have in is it of on or our that the their this to we with will you your deck slides presentation about need want make'.split(
    ' ',
  ),
);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export interface StorylineScore {
  storyline: Storyline;
  score: number;
  matched: string[];
}

export function rankStorylines(
  brief: Pick<Brief, 'task' | 'goal' | 'ask' | 'context' | 'audience'>,
  all = loadStorylines(),
): StorylineScore[] {
  const text = [
    brief.task ?? '',
    brief.task ?? '',
    brief.goal,
    brief.ask ?? '',
    brief.context ?? '',
  ]
    .join(' ')
    .toLowerCase();
  const words = new Set(tokens(text));
  const audience = (brief.audience?.who ?? '').toLowerCase();
  return all
    .map((s) => {
      let score = 0;
      const matched: string[] = [];
      for (const phrase of s.bestFor) {
        const p = phrase.toLowerCase();
        if (p.includes(' ') ? text.includes(p) : words.has(p)) {
          score += p.includes(' ') ? 3 : 2;
          matched.push(phrase);
        } else if (tokens(p).some((t) => words.has(t))) {
          score += 0.5;
        }
      }
      if (brief.task && s.name.toLowerCase().includes(brief.task.toLowerCase())) score += 4;
      for (const a of s.audiences) {
        // whole-phrase match: "executive committee" should not match "procurement committee"
        if (audience?.includes(a.toLowerCase())) {
          score += 1.5;
          matched.push(`audience: ${a}`);
        }
      }
      return { storyline: s, score, matched };
    })
    .sort((a, b) => b.score - a.score || a.storyline.id.localeCompare(b.storyline.id));
}

export interface TemplateOption {
  option: 'A' | 'B' | 'C';
  storyline: string;
  theme: string;
  why: string;
  storylineName: string;
  themeName: string;
  arc: string;
  preview?: string;
}

/**
 * Three options with real contrast:
 *  A — best storyline in its best theme,
 *  B — same storyline, a visibly different theme,
 *  C — the runner-up storyline (a different story shape) in its best theme.
 */
export function templateOptions(brief: Brief, themes: Theme[] = loadThemes()): TemplateOption[] {
  const ranked = rankStorylines(brief);
  const best = ranked[0]!;
  const second = ranked.find((r) => r.storyline.id !== best.storyline.id) ?? best;
  const themeIds = new Set(themes.map((t) => t.id));
  const pick = (s: Storyline, avoid: string[] = []) => {
    if (brief.brand?.theme && themeIds.has(brief.brand.theme) && !avoid.includes(brief.brand.theme))
      return brief.brand.theme;
    return (
      s.themes.find((t) => themeIds.has(t) && !avoid.includes(t)) ??
      themes.find((t) => !avoid.includes(t.id))!.id
    );
  };
  const tA = pick(best.storyline);
  const tB = pick(best.storyline, [tA]);
  const tC = pick(second.storyline, [tA, tB]);
  const name = (id: string) => themes.find((t) => t.id === id)?.name ?? id;
  const why = (r: StorylineScore) =>
    r.matched.length ? `matches ${r.matched.slice(0, 4).join(', ')}` : 'closest general fit';
  return [
    {
      option: 'A',
      storyline: best.storyline.id,
      theme: tA,
      why: why(best),
      storylineName: best.storyline.name,
      themeName: name(tA),
      arc: best.storyline.arc,
    },
    {
      option: 'B',
      storyline: best.storyline.id,
      theme: tB,
      why: `same story, ${name(tB)} look`,
      storylineName: best.storyline.name,
      themeName: name(tB),
      arc: best.storyline.arc,
    },
    {
      option: 'C',
      storyline: second.storyline.id,
      theme: tC,
      why: `different story shape — ${why(second)}`,
      storylineName: second.storyline.name,
      themeName: name(tC),
      arc: second.storyline.arc,
    },
  ];
}
