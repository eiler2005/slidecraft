/**
 * Speaker notes carry where each slide's facts come from: the slide's `sources:` resolved
 * against the deck registry (title, publisher, date, place, link) plus a free-text `source:`.
 * Every engine that writes notes (PPTX, HTML deck, DOCX) receives the same block, and
 * `slidecraft sync` strips it again so it never travels back into deck.yaml.
 */
import { parseSourceRef, type Slide, type Source } from '../spec/deck.ts';

/** Marker line of the generated block, identical in every language so tools can find it. */
export const SOURCES_HEADING = '[Sources]';
const ILLUSTRATIVE: Record<string, string> = {
  en: 'illustrative data',
  ru: 'иллюстративные данные',
};

/** The generated block for one slide, or undefined when it cites nothing. */
export function sourceNotes(
  slide: Pick<Slide, 'sources' | 'source'>,
  registry: Map<string, Source>,
  language = 'en',
): string | undefined {
  const lines: string[] = [];
  for (const ref of slide.sources ?? []) {
    const r = parseSourceRef(ref);
    const s = registry.get(r.id);
    if (!s) continue;
    const parts = [
      s.title,
      s.publisher,
      s.date,
      r.where,
      s.url ? (r.page && /\.pdf($|\?)/i.test(s.url) ? `${s.url}#page=${r.page}` : s.url) : s.file,
      s.illustrative ? (ILLUSTRATIVE[language.slice(0, 2)] ?? ILLUSTRATIVE.en) : undefined,
    ].filter(Boolean);
    lines.push(`- ${parts.join(' — ')}`);
  }
  if (slide.source) lines.push(`- ${slide.source}`);
  return lines.length ? [SOURCES_HEADING, ...lines].join('\n') : undefined;
}

/** Author notes followed by the generated sources block. */
export function withSourceNotes(notes: string | undefined, block: string | undefined) {
  return [notes?.trim(), block].filter(Boolean).join('\n\n') || undefined;
}

/** Remove the generated block from notes read back from a PPTX. */
export function stripSourceNotes(text: string): string {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === SOURCES_HEADING);
  return (at < 0 ? text : lines.slice(0, at).join('\n')).trimEnd();
}
