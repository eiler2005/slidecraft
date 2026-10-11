/**
 * Stable diagnostic codes. Agents key their fixes off these, so codes never change
 * meaning; retire a code instead of reusing it. `docs/reference/error-codes.gen.md`
 * is generated from this table.
 */
export type Severity = 'error' | 'warning' | 'info';

export interface CodeInfo {
  severity: Severity;
  title: string;
  why: string;
  fix: string;
}

export const CODES = {
  'SC-SPEC-001': {
    severity: 'error',
    title: 'Deck does not match the schema',
    why: 'A field is missing, misspelled, has the wrong type or exceeds its declared capacity.',
    fix: 'Read `slidecraft layouts --json` for the layout contract and correct the field at the pointer.',
  },
  'SC-SPEC-002': {
    severity: 'error',
    title: 'Unknown reference',
    why: 'A theme, storyline, layout, variant or source id does not exist.',
    fix: 'Use an id from `slidecraft themes`, `slidecraft storylines`, `slidecraft layouts` or the deck `sources:` list.',
  },
  'SC-SPEC-003': {
    severity: 'error',
    title: 'Duplicate slide id',
    why: 'Slide ids must be unique so reviews and fixes can target one slide.',
    fix: 'Give every slide a unique kebab-case `id`.',
  },
  'SC-SPEC-004': {
    severity: 'error',
    title: 'Included section file not found',
    why: 'A `- include: path.yaml` entry points to a missing or invalid file.',
    fix: 'Check the path (relative to deck.yaml) and that the file contains a YAML list of slides.',
  },
  'SC-FIT-001': {
    severity: 'error',
    title: 'Text overflows its box',
    why: 'At the smallest allowed size the text still needs more lines than the box holds. SlideCraft never truncates.',
    fix: 'Shorten the text by roughly the reported characters, split the point, or move detail to notes/backup.',
  },
  'SC-FIT-002': {
    severity: 'warning',
    title: 'Text shrunk below the preferred size',
    why: 'Copy-fitting stepped the font size down to make the text fit.',
    fix: 'Optional: tighten the wording so the slide renders at the theme body size.',
  },
  'SC-FIT-003': {
    severity: 'error',
    title: 'Word too long for its box',
    why: 'A single word or token is wider than the column and would be split mid-word.',
    fix: 'Hyphenate, abbreviate, or choose a layout with wider columns.',
  },
  'SC-FIT-004': {
    severity: 'error',
    title: 'Freeform HTML overflows its box',
    why: 'The content of a freeform slide is taller or wider than the slide body, so part of it would be cut off.',
    fix: 'Shorten the text, reduce elements or sizes in the HTML/CSS, or split the slide.',
  },
  'SC-FIT-005': {
    severity: 'warning',
    title: 'Freeform text below the minimum size',
    why: 'Text in a freeform slide is smaller than the theme minimum and will be hard to read when presented.',
    fix: 'Raise the font size in the CSS or cut text so it fits at a readable size.',
  },
  'SC-HTML-001': {
    severity: 'warning',
    title: 'Unsafe or external content removed from freeform HTML',
    why: 'Scripts, event handlers, frames and remote URLs are stripped so decks render offline, deterministically and without leaking data.',
    fix: 'Use inline SVG, CSS and images next to the deck (relative paths) instead.',
  },
  'SC-TITLE-001': {
    severity: 'error',
    title: 'Action title runs past two lines',
    why: 'Titles are the argument of the deck; more than two lines stops them being skimmable.',
    fix: 'Cut to one claim of ~8–14 words (under ~90 characters).',
  },
  'SC-TITLE-002': {
    severity: 'warning',
    title: 'Title reads like a topic, not a claim',
    why: 'Short noun phrases ("Market overview") state a subject but not the so-what.',
    fix: 'Rewrite as a full sentence with a verb that states the takeaway (see action-title-writer skill).',
  },
  'SC-TITLE-003': {
    severity: 'warning',
    title: 'Title ends with punctuation',
    why: 'Consulting convention: action titles carry no trailing period.',
    fix: 'Remove the trailing period.',
  },
  'SC-SRC-001': {
    severity: 'warning',
    title: 'Numbers without a source',
    why: 'The slide shows figures but cites no source. Every number must be traceable.',
    fix: 'Add `sources: [id]` (from the deck `sources:` list) or a `source:` line. Mark illustrative data as such.',
  },
  'SC-SRC-002': {
    severity: 'error',
    title: 'Final deck has unsourced numbers',
    why: 'Decks with status `final` must cite every figure.',
    fix: 'Add sources, or set status back to `review`.',
  },
  'SC-GLYPH-001': {
    severity: 'error',
    title: 'Font lacks glyphs for this text',
    why: 'The measuring font has no glyphs for some characters, so layout cannot be guaranteed.',
    fix: 'Use a theme whose fonts cover the script, or set a `fonts.cyrillic` override in the theme.',
  },
  'SC-GEOM-001': {
    severity: 'error',
    title: 'Element outside the slide',
    why: 'A node extends beyond the page and would be clipped.',
    fix: 'This is a layout bug — report it with the deck that triggers it.',
  },
  'SC-GEOM-002': {
    severity: 'warning',
    title: 'Content elements overlap',
    why: 'Two text or data elements intersect.',
    fix: 'Reduce content so the layout can space it, or report a layout bug.',
  },
  'SC-GEOM-003': {
    severity: 'warning',
    title: 'Text spills out of its panel',
    why: 'Text starts inside a card, band or panel but its ink extends past the panel edge.',
    fix: 'Shorten the text, reduce the number of items, or choose a layout with larger panels.',
  },
  'SC-GEOM-004': {
    severity: 'error',
    title: 'Text hidden under a shape',
    why: 'An opaque shape, picture, chart or table is drawn after the text and covers it, so the text is invisible.',
    fix: 'Layout bug: draw backgrounds before the text they hold.',
  },
  'SC-CONTRAST-001': {
    severity: 'warning',
    title: 'Low text contrast',
    why: 'Text color against its background is below WCAG AA (4.5:1 body, 3:1 large).',
    fix: 'Adjust the theme colors or the highlight choice.',
  },
  'SC-DENSITY-001': {
    severity: 'warning',
    title: 'Slide is dense',
    why: 'The slide carries more words than a reader can absorb in one pass.',
    fix: 'Split into two slides or move detail into speaker notes.',
  },
  'SC-STORY-001': {
    severity: 'info',
    title: 'Storyline slot not covered',
    why: 'The chosen storyline expects a slide for this purpose and none was found.',
    fix: 'Add the slide, or ignore if the slot does not apply to this deck.',
  },
  'SC-PPTX-001': {
    severity: 'error',
    title: 'Text missing from the PPTX',
    why: 'A string from the scene was not found in the written presentation XML.',
    fix: 'This is an engine bug — report it with the deck that triggers it.',
  },
  'SC-IMG-001': {
    severity: 'warning',
    title: 'Image resolution too low',
    why: 'Effective resolution at its placed size is below 144 ppi; it will look soft when projected.',
    fix: 'Supply a larger image or place it smaller.',
  },
  'SC-IMG-002': {
    severity: 'info',
    title: 'Image placeholder',
    why: 'An image slot has no image yet; a labelled placeholder was rendered.',
    fix: 'Set `image: path/to/file.png` (relative to deck.yaml).',
  },
  'SC-A11Y-001': {
    severity: 'warning',
    title: 'Picture or chart without alt text',
    why: 'Screen readers announce nothing useful, and PowerPoint’s accessibility checker flags the slide.',
    fix: 'Give images an `alt`; decorative images are marked decorative automatically.',
  },
  'SC-A11Y-002': {
    severity: 'warning',
    title: 'Slide title is not first in reading order',
    why: 'Screen readers read shapes in tree order; the title should come first so the slide is announced by its claim.',
    fix: 'Rebuild with the bundled engine; SlideCraft moves the title to the front.',
  },
  'SC-A11Y-003': {
    severity: 'warning',
    title: 'Slide has no title placeholder',
    why: 'Without a title, the slide is unnamed in PowerPoint’s outline, navigation and screen readers.',
    fix: 'Every SlideCraft layout writes its action title as the title placeholder; check custom post-processing.',
  },
  'SC-DATA-001': {
    severity: 'error',
    title: 'Data file or sheet not found',
    why: 'A fact, chart or table reads from a spreadsheet that is missing or has no such sheet.',
    fix: 'Check `file` (relative to deck.yaml) and `sheet`; files are read again on every build.',
  },
  'SC-DATA-002': {
    severity: 'error',
    title: 'Data range does not fit the field',
    why: 'A `from:` reference is incomplete (no cell or range) or the cells are not what the field needs (e.g. text where a number is expected).',
    fix: 'Point `range` at a block with a header row and numbers (charts), or `cell` at one value (facts).',
  },
  'SC-DATA-003': {
    severity: 'error',
    title: 'Unknown fact',
    why: 'Text uses {{id}} but the deck `facts:` has no such id.',
    fix: 'Add the fact to `facts:` or correct the id.',
  },
  'SC-CONSIST-001': {
    severity: 'warning',
    title: 'The same number differs between slides',
    why: 'One metric appears with different values on different slides — the error a board notices first.',
    fix: 'Use one value everywhere; define it once in `facts:` and write {{id}} in the text.',
  },
  'SC-SRC-003': {
    severity: 'error',
    title: 'Unknown source page reference',
    why: 'A slide cites `id#p12` but the source id does not exist.',
    fix: 'Use an id from the deck `sources:` list, e.g. `annual-report#p14`.',
  },
  'SC-ENGINE-001': {
    severity: 'warning',
    title: 'Engine unavailable, skipped',
    why: 'The requested engine is not installed or not detected on this machine.',
    fix: 'Run `slidecraft doctor` for install hints, or choose another engine.',
  },
} as const satisfies Record<string, CodeInfo>;

export type Code = keyof typeof CODES;

export interface Diagnostic {
  code: Code;
  severity: Severity;
  message: string;
  slide?: string;
  /** JSON pointer into the deck document, e.g. /slides/3/points/1 */
  pointer?: string;
  measured?: string;
  limit?: string;
  hint?: string;
}

export function diag(
  code: Code,
  message: string,
  extra: Partial<Omit<Diagnostic, 'code' | 'message'>> = {},
): Diagnostic {
  return {
    code,
    severity: extra.severity ?? CODES[code].severity,
    message,
    hint: CODES[code].fix,
    ...extra,
  };
}
