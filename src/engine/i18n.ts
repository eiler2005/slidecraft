/**
 * Words SlideCraft itself puts on slides (labels, the source prefix) follow the deck language,
 * and typography follows that language's rules. Content is never translated here.
 */
export type LabelKey =
  | 'source'
  | 'decision'
  | 'recommended'
  | 'soWhat'
  | 'likelihood'
  | 'impact'
  | 'delivers'
  | 'today'
  | 'target'
  | 'baseCase'
  | 'margin'
  | 'support'
  | 'primary'
  | 'strategy'
  | 'structure'
  | 'systems'
  | 'sharedValues'
  | 'style'
  | 'staff'
  | 'skills'
  | 'aligned'
  | 'partial'
  | 'gap'
  | 'photo'
  | 'illustrative';

const LABELS: Record<string, Record<LabelKey, string>> = {
  en: {
    source: 'Source:',
    decision: 'Decision requested',
    recommended: 'Recommended',
    soWhat: 'So what',
    likelihood: 'Likelihood',
    impact: 'Impact',
    delivers: 'Delivers',
    today: 'Today',
    target: 'Target',
    baseCase: 'Base case',
    margin: 'Margin',
    support: 'Support activities',
    primary: 'Primary activities',
    strategy: 'Strategy',
    structure: 'Structure',
    systems: 'Systems',
    sharedValues: 'Shared values',
    style: 'Style',
    staff: 'Staff',
    skills: 'Skills',
    aligned: 'Aligned',
    partial: 'Partial',
    gap: 'Gap',
    photo: 'Photo',
    illustrative: 'Illustrative data.',
  },
  ru: {
    source: 'Источник:',
    decision: 'Требуется решение',
    recommended: 'Рекомендуем',
    soWhat: 'Что это значит',
    likelihood: 'Вероятность',
    impact: 'Влияние',
    delivers: 'Результат',
    today: 'Сейчас',
    target: 'Цель',
    baseCase: 'Базовый сценарий',
    margin: 'Маржа',
    support: 'Вспомогательные процессы',
    primary: 'Основные процессы',
    strategy: 'Стратегия',
    structure: 'Структура',
    systems: 'Системы',
    sharedValues: 'Общие ценности',
    style: 'Стиль',
    staff: 'Персонал',
    skills: 'Навыки',
    aligned: 'Согласовано',
    partial: 'Частично',
    gap: 'Разрыв',
    photo: 'Фото',
    illustrative: 'Иллюстративные данные.',
  },
  de: {
    source: 'Quelle:',
    decision: 'Entscheidung erbeten',
    recommended: 'Empfohlen',
    soWhat: 'Was das heißt',
    likelihood: 'Wahrscheinlichkeit',
    impact: 'Auswirkung',
    delivers: 'Liefert',
    today: 'Heute',
    target: 'Ziel',
    baseCase: 'Basisfall',
    margin: 'Marge',
    support: 'Unterstützende Aktivitäten',
    primary: 'Primäre Aktivitäten',
    strategy: 'Strategie',
    structure: 'Struktur',
    systems: 'Systeme',
    sharedValues: 'Gemeinsame Werte',
    style: 'Stil',
    staff: 'Personal',
    skills: 'Fähigkeiten',
    aligned: 'Stimmig',
    partial: 'Teilweise',
    gap: 'Lücke',
    photo: 'Foto',
    illustrative: 'Illustrative Daten.',
  },
};

export function label(language: string | undefined, key: LabelKey): string {
  return (LABELS[(language ?? 'en').slice(0, 2)] ?? LABELS.en!)[key];
}

const CULTURES: Record<string, string> = { en: 'en-US', ru: 'ru-RU', de: 'de-DE' };

/**
 * BCP 47 culture for a deck language ("ru" → "ru-RU"): number formatting (1 234,5 in
 * Russian) and the proofing language PowerPoint and Word spell-check the text in.
 */
export function culture(language: string | undefined): string {
  const lang = language ?? 'en';
  if (lang.includes('-')) return lang;
  return CULTURES[lang.slice(0, 2)] ?? lang;
}

/** True when the theme's source prefix is the English default, so it may be localised. */
export const isDefaultSourcePrefix = (prefix: string | undefined) =>
  prefix === undefined || prefix === LABELS.en!.source;

const NBSP = ' ';

/**
 * Language typography for generated text. Russian: a one- or two-letter word (в, с, и, на,
 * не…) never ends a line, and a dash never starts one — joined with no-break spaces, which
 * PowerPoint, browsers and the layout all honour.
 */
export function typeset(text: string, language: string | undefined): string {
  if ((language ?? '').slice(0, 2) !== 'ru') return text;
  let out = text;
  // twice: "и в процессе" needs both short words bound
  for (let i = 0; i < 2; i++)
    out = out.replace(/(^|[\s(«„"'])([А-Яа-яЁё]{1,2}) (?=\S)/gu, `$1$2${NBSP}`);
  return out.replace(/ ([—–])(?=\s)/gu, `${NBSP}$1`);
}
