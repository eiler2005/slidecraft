/**
 * Cover options: the cover is the first impression, so it is chosen, not defaulted. For the
 * deck's cover slide SlideCraft renders 2–3 candidates — the topic motifs that fit the title
 * best and, when the slide has a picture or an `imageQuery`, a photo — with the facts a
 * reviewer needs to compare them (which topic words a motif answers, a photo's licence and
 * sharpness on the panel). The agent compares them against the deck's message and look,
 * recommends one, and the user chooses; `--choose` writes the choice into deck.yaml.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import YAML, { isMap, isSeq } from 'yaml';
import { rasterize } from '../backends/resvg.ts';
import { slideSvg } from '../backends/svg.ts';
import { composeDeck } from '../engine/compose.ts';
import { rankCoverArt } from '../layouts/cover-art.ts';
import { pngSize } from '../qa/pptx-verify.ts';
import { type ImageCredit, listStock, type StockProvider } from './images.ts';
import { loadDeck } from './load.ts';

export interface CoverOption {
  option: string;
  kind: 'motif' | 'photo';
  label: string;
  /** Fields the choice writes into the cover slide; `null` removes a field. */
  fields: Record<string, unknown>;
  /** Picture to copy into assets/ when this option is chosen. */
  file?: string;
  preview: string;
  facts: {
    /** Words of the title, kicker and subtitle this motif stands for. */
    topicWords?: string[];
    credit?: ImageCredit;
    /** Effective resolution of the photo on the cover panel; ≥ 144 is sharp when projected. */
    ppi?: number;
    pixels?: { w: number; h: number };
  };
}

export interface CoverOptions {
  deck: string;
  slideId: string;
  message: { title: string; kicker?: string; subtitle?: string };
  options: CoverOption[];
  picker: string;
  next: string;
}

const LETTERS = ['A', 'B', 'C'];

function coverIndex(slides: { layout: string; variant?: string }[]): number {
  return slides.findIndex((s) => s.layout === 'title' && (s.variant ?? 'cover') === 'cover');
}

/** Render 2–3 cover candidates for the deck's cover slide. */
export async function coverOptions(
  deckPath: string,
  opts: { provider?: StockProvider; fetchImpl?: typeof fetch; out?: string } = {},
): Promise<CoverOptions> {
  const path = resolve(deckPath);
  const base = dirname(path);
  const out = resolve(opts.out ?? join(base, '.slidecraft', 'covers'));
  mkdirSync(out, { recursive: true });
  const loaded = loadDeck(path);
  const k = coverIndex(loaded.slides as never);
  if (k < 0) throw new Error('the deck has no cover slide (layout: title, variant: cover)');
  const cover = loaded.slides[k] as unknown as Record<string, unknown> & {
    id: string;
    title: string;
  };
  const message = {
    title: cover.title,
    ...(typeof cover.kicker === 'string' ? { kicker: cover.kicker } : {}),
    ...(typeof cover.subtitle === 'string' ? { subtitle: cover.subtitle } : {}),
  };
  const text = [message.title, message.kicker, message.subtitle].filter(Boolean).join(' ');
  const ranked = rankCoverArt(text);

  type Draft = Omit<CoverOption, 'option' | 'preview'>;
  const drafts: Draft[] = [];
  // a photo: the slide's own picture, or the best stock candidate for its imageQuery
  const own = typeof cover.image === 'string' ? resolve(base, cover.image) : undefined;
  if (own && existsSync(own)) {
    drafts.push({
      kind: 'photo',
      label: 'Current photo',
      fields: { image: cover.image },
      facts: {
        ...(cover.imageCredit ? { credit: cover.imageCredit as ImageCredit } : {}),
      },
    });
  } else if (typeof cover.imageQuery === 'string' && opts.provider) {
    const [list] = await listStock(
      [{ slideId: cover.id, query: cover.imageQuery, image: '', file: '', yamlFile: path }],
      opts.provider,
      1,
    );
    const hit = list?.hits[0];
    if (hit) {
      const res = await (opts.fetchImpl ?? fetch)(hit.url);
      if (res.ok) {
        const file = join(out, `photo${extname(new URL(hit.url).pathname) || '.jpg'}`);
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        drafts.push({
          kind: 'photo',
          label: `Stock photo: ${hit.credit.title ?? list!.query}`,
          fields: { image: relative(base, file), imageCredit: hit.credit },
          file,
          facts: { credit: hit.credit },
        });
      }
    }
  }
  // motifs that answer the deck's words, best first; at least two options in total
  const motifs = ranked.filter((r) => r.score > 0);
  const pool = [...motifs, ...ranked.filter((r) => r.score === 0)];
  for (const r of pool) {
    if (drafts.length >= 3 || (drafts.length >= 2 && r.score === 0)) break;
    drafts.push({
      kind: 'motif',
      label: `Motif: ${r.art}`,
      fields: { art: r.art, image: null, imageCredit: null, imageQuery: null, imagePrompt: null },
      facts: { topicWords: r.matched },
    });
  }
  // a motif that fits best leads; a photo comes first only when the deck already has one
  const ordered = own
    ? drafts
    : [...drafts.filter((d) => d.kind === 'motif'), ...drafts.filter((d) => d.kind === 'photo')];

  const options: CoverOption[] = [];
  for (const [i, d] of ordered.slice(0, 3).entries()) {
    const slide = { ...cover } as Record<string, unknown>;
    for (const [key, v] of Object.entries(d.fields)) {
      if (v === null) delete slide[key];
      else slide[key] = key === 'image' ? resolve(base, String(v)) : v;
    }
    if (d.kind === 'photo') delete slide.art;
    // options are judged as finished covers, even while the deck is still a ghost deck
    slide.status = 'draft';
    delete slide.ghost;
    const variant = {
      ...loaded,
      deck: { ...loaded.deck, status: 'draft' as const },
      slides: [slide] as never,
      diagnostics: [],
    };
    const { scene } = composeDeck(variant);
    const preview = join(out, `option-${LETTERS[i]}.png`);
    writeFileSync(preview, await rasterize(slideSvg(scene, scene.slides[0]!), 1200));
    const facts = { ...d.facts };
    const pic = d.file ?? (d.kind === 'photo' ? own : undefined);
    if (pic) {
      const px = pngSize(readFileSync(pic));
      if (px) {
        // the cover panel is 30 % of the page wide and full height
        const panelW = scene.format.w * 0.3;
        const panelH = scene.format.h;
        facts.pixels = px;
        facts.ppi = Math.round(Math.min(px.w / panelW, px.h / panelH));
      }
    }
    options.push({ ...d, option: LETTERS[i]!, preview, facts });
  }
  const result: CoverOptions = {
    deck: path,
    slideId: cover.id,
    message,
    options,
    picker: join(out, 'covers.html'),
    next: 'Compare the options against the deck message and look (topic fit, legibility, photo sharpness and licence), recommend one, ask the user, then `slidecraft covers <deck> --choose <letter>`.',
  };
  writeFileSync(join(out, 'options.json'), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(result.picker, pickerHtml(result));
  return result;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pickerHtml(r: CoverOptions): string {
  const cards = r.options
    .map((o) => {
      const img = `data:image/png;base64,${readFileSync(o.preview).toString('base64')}`;
      const facts = [
        o.facts.topicWords?.length ? `stands for: ${o.facts.topicWords.join(', ')}` : '',
        o.facts.credit
          ? `${o.facts.credit.author} / ${o.facts.credit.provider}, ${o.facts.credit.license}`
          : '',
        o.facts.ppi
          ? `${o.facts.ppi} ppi on the panel${o.facts.ppi < 144 ? ' (soft when projected)' : ''}`
          : '',
      ].filter(Boolean);
      return `<article class="card"><header><span class="badge">${o.option}</span><h2>${esc(o.label)}</h2></header><img src="${img}" alt="Cover option ${o.option}: ${esc(o.label)}"><ul>${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></article>`;
    })
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SlideCraft — choose a cover</title>
<style>
:root{--bg:#F4F6F9;--ink:#0B1F3A;--muted:#5B6B7F;--card:#fff;--accent:#1F5FBF}
@media (prefers-color-scheme:dark){:root{--bg:#0E1116;--ink:#EEF1F5;--muted:#A3ADBA;--card:#171B22;--accent:#6EA1F0}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
main{max-width:1500px;margin:0 auto;padding:32px 20px}h1{font-size:26px;margin:0 0 4px}.goal{color:var(--muted);margin:0 0 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px}
.card{background:var(--card);border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card header{display:flex;gap:12px;align-items:center;margin-bottom:12px}.card h2{font-size:17px;margin:0}
.badge{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700}
img{width:100%;border-radius:8px;display:block}ul{color:var(--muted);margin:10px 0 0;padding-left:18px}
footer{margin-top:24px;color:var(--muted)}
</style></head><body><main><h1>Choose a cover</h1><p class="goal">${esc(r.message.title)}</p>
<div class="grid">${cards}</div>
<footer>Reply with A, B or C — the assistant writes your choice into deck.yaml.</footer></main></body></html>`;
}

/** Write the chosen option into the cover slide of deck.yaml. */
export function chooseCover(deckPath: string, letter: string, optionsFile?: string): CoverOption {
  const path = resolve(deckPath);
  const base = dirname(path);
  const file = optionsFile ?? join(base, '.slidecraft', 'covers', 'options.json');
  if (!existsSync(file))
    throw new Error('no cover options yet: run `slidecraft covers <deck>` first');
  const r = JSON.parse(readFileSync(file, 'utf8')) as CoverOptions;
  const o = r.options.find((x) => x.option === letter.toUpperCase());
  if (!o)
    throw new Error(
      `no option ${letter}; choose one of ${r.options.map((x) => x.option).join(', ')}`,
    );
  const fields = { ...o.fields };
  if (o.file) {
    // the chosen photo moves next to the deck, where `image:` points
    const dest = join(base, 'assets', `${r.slideId}${extname(o.file)}`);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(o.file, dest);
    fields.image = relative(base, dest);
  }
  const doc = YAML.parseDocument(readFileSync(path, 'utf8'));
  const slides = doc.get('slides', true);
  if (!isSeq(slides)) throw new Error('deck.yaml has no slides list');
  const k = slides.items.findIndex((m) => isMap(m) && m.get('id') === r.slideId);
  if (k < 0)
    throw new Error(`cover slide "${r.slideId}" is not in deck.yaml itself (an included file?)`);
  for (const [key, v] of Object.entries(fields)) {
    if (v === null) doc.deleteIn(['slides', k, key]);
    else doc.setIn(['slides', k, key], v);
  }
  writeFileSync(path, doc.toString({ lineWidth: 0 }));
  return { ...o, fields };
}
