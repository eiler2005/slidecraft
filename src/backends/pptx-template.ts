/**
 * Template masters (M3): put a built deck into the customer's own PowerPoint package.
 *
 * The template keeps its slide masters, layouts, theme and art; its own slides are removed.
 * Every SlideCraft slide is linked to the template layout that matches its role (cover →
 * Title Slide, content → Title Only / Title and Content, divider → Section Header), so
 * PowerPoint's Layout menu, master edits and the brand's background apply. Slide numbers
 * and footers use the layout's own placeholders. Charts, media and notes come along.
 */
import { posix } from 'node:path';
import JSZip from 'jszip';

interface Rel {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

const relsPath = (part: string) => `${posix.dirname(part)}/_rels/${posix.basename(part)}.rels`;

function parseRels(xml: string): Rel[] {
  return [...xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)].map((m) => {
    const a = m[1]!;
    const get = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(a)?.[1] ?? '';
    return {
      id: get('Id'),
      type: get('Type'),
      target: get('Target'),
      external: get('TargetMode') === 'External',
    };
  });
}

function writeRels(rels: Rel[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map(
      (r) =>
        `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`,
    )
    .join('')}</Relationships>`;
}

const resolveTarget = (from: string, target: string) =>
  target.startsWith('/')
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(from), target));
const relative = (from: string, to: string) => posix.relative(posix.dirname(from), to);
const typeOf = (t: string) => t.slice(t.lastIndexOf('/') + 1);

async function rels(zip: JSZip, part: string): Promise<Rel[]> {
  const f = zip.file(relsPath(part));
  return f ? parseRels(await f.async('string')) : [];
}

interface ContentTypes {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
}

function parseTypes(xml: string): ContentTypes {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  for (const m of xml.matchAll(/<Default Extension="([^"]+)" ContentType="([^"]+)"\s*\/>/g))
    defaults.set(m[1]!.toLowerCase(), m[2]!);
  for (const m of xml.matchAll(/<Override PartName="([^"]+)" ContentType="([^"]+)"\s*\/>/g))
    overrides.set(m[1]!.replace(/^\//, ''), m[2]!);
  return { defaults, overrides };
}

function writeTypes(ct: ContentTypes): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${[
    ...ct.defaults,
  ]
    .map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`)
    .join(
      '',
    )}${[...ct.overrides].map(([p, t]) => `<Override PartName="/${p}" ContentType="${t}"/>`).join('')}</Types>`;
}

const ext = (p: string) => p.slice(p.lastIndexOf('.') + 1).toLowerCase();

/** Parts reachable from the package root through relationships. */
async function reachable(zip: JSZip): Promise<Set<string>> {
  const seen = new Set<string>();
  const walk = async (part: string, list: Rel[]) => {
    for (const r of list) {
      if (r.external) continue;
      const t = resolveTarget(part, r.target);
      if (seen.has(t) || !zip.file(t)) continue;
      seen.add(t);
      await walk(t, await rels(zip, t));
    }
  };
  const root = zip.file('_rels/.rels');
  if (root) await walk('', parseRels(await root.async('string')));
  return seen;
}

export interface TemplateLayouts {
  cover: string;
  content: string;
  divider: string;
}

/** Pick the template layout for each SlideCraft master by layout type. */
export async function templateLayouts(zip: JSZip): Promise<TemplateLayouts> {
  const found: { part: string; type: string }[] = [];
  for (const name of Object.keys(zip.files)
    .filter((n) => /^ppt\/slideLayouts\/[^/]+\.xml$/.test(n))
    .sort((a, b) => +(/(\d+)\.xml$/.exec(a)?.[1] ?? 0) - +(/(\d+)\.xml$/.exec(b)?.[1] ?? 0))) {
    const xml = await zip.file(name)!.async('string');
    found.push({ part: name, type: /<p:sldLayout\b[^>]*\btype="(\w+)"/.exec(xml)?.[1] ?? '' });
  }
  const by = (...types: string[]) =>
    types.map((t) => found.find((f) => f.type === t)?.part).find(Boolean);
  const first = found[0]?.part ?? '';
  const content = by('titleOnly', 'obj', 'tx') ?? found[1]?.part ?? first;
  const cover = by('title') ?? first;
  return { cover, content, divider: by('secHead') ?? cover };
}

const PRES = 'ppt/presentation.xml';
const T_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const T_NOTES_MASTER =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster';
const PRES_MAIN =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';

/** Placeholder shapes the slide needs so the layout's slide number / footer show. */
function placeholderShapes(
  layoutXml: string,
  slideNo: number,
  footer: string | undefined,
  idBase: number,
): string {
  const out: string[] = [];
  const ph = (type: string) => {
    for (const m of layoutXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      const tag = new RegExp(`<p:ph\\s[^>]*type="${type}"[^>]*/>`).exec(m[1]!)?.[0];
      if (tag) return tag;
    }
    return undefined;
  };
  const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
  const num = ph('sldNum');
  if (num)
    out.push(
      `<p:sp><p:nvSpPr><p:cNvPr id="${idBase}" name="Slide Number"/><p:cNvSpPr><a:spLocks ${A} noGrp="1"/></p:cNvSpPr><p:nvPr>${num}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr ${A}/><a:lstStyle ${A}/><a:p ${A}><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:t>${slideNo}</a:t></a:fld></a:p></p:txBody></p:sp>`,
    );
  const ftr = footer ? ph('ftr') : undefined;
  if (ftr && footer)
    out.push(
      `<p:sp><p:nvSpPr><p:cNvPr id="${idBase + 1}" name="Footer"/><p:cNvSpPr><a:spLocks ${A} noGrp="1"/></p:cNvSpPr><p:nvPr>${ftr}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr ${A}/><a:lstStyle ${A}/><a:p ${A}><a:r><a:t>${footer.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a:t></a:r></a:p></p:txBody></p:sp>`,
    );
  return out.join('');
}

export async function applyTemplate(
  deck: Buffer,
  template: Buffer,
  opts: { footer?: string } = {},
): Promise<{ buf: Buffer; notes: string[] }> {
  const ours = await JSZip.loadAsync(deck);
  const out = await JSZip.loadAsync(template);
  const notes: string[] = [];
  const oursTypes = parseTypes(await ours.file('[Content_Types].xml')!.async('string'));
  const types = parseTypes(await out.file('[Content_Types].xml')!.async('string'));
  if (types.overrides.get(PRES) !== PRES_MAIN) types.overrides.set(PRES, PRES_MAIN); // .potx → .pptx

  // 1. drop the template's own slides, then everything only they used
  let pres = await out.file(PRES)!.async('string');
  const presRels = (await rels(out, PRES)).filter((r) => r.type !== T_SLIDE);
  out.file(relsPath(PRES), writeRels(presRels));
  pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\s*\/>/, '');
  out.file(PRES, pres);
  const keep = await reachable(out);
  for (const name of Object.keys(out.files)) {
    if (out.files[name]!.dir || name === '[Content_Types].xml' || name === '_rels/.rels') continue;
    const owner = name.includes('/_rels/') ? name.replace(/_rels\/([^/]+)\.rels$/, '$1') : name;
    if (!keep.has(owner)) {
      out.remove(name);
      types.overrides.delete(name);
    }
  }

  // 2. layouts and notes master to link to
  const layouts = await templateLayouts(out);
  let notesMaster = presRels.find((r) => r.type === T_NOTES_MASTER);
  const nextRid = () =>
    `rId${Math.max(0, ...presRels.map((r) => +(/\d+/.exec(r.id)?.[0] ?? 0))) + 1}`;

  // 3. copy our parts with a prefix, remapping layouts / notes master
  const copied = new Map<string, string>();
  const typeFor = (p: string) => oursTypes.overrides.get(p) ?? oursTypes.defaults.get(ext(p));
  const copy = async (
    src: string,
    dest: string,
    remap: (r: Rel, target: string) => string | undefined,
  ) => {
    copied.set(src, dest);
    const data = await ours.file(src)!.async('uint8array');
    out.file(dest, data);
    const t = typeFor(src);
    if (t) {
      if (/\.xml$/i.test(dest)) types.overrides.set(dest, t);
      else if (!types.defaults.has(ext(dest))) types.defaults.set(ext(dest), t);
    }
    const list = await rels(ours, src);
    if (!list.length) return;
    const mapped: Rel[] = [];
    for (const r of list) {
      if (r.external) {
        mapped.push(r);
        continue;
      }
      const target = resolveTarget(src, r.target);
      let to = remap(r, target);
      if (!to) {
        to = copied.get(target);
        if (!to) {
          const dir = posix.dirname(target);
          to = `${dir}/sc-${posix.basename(target)}`;
          if (ours.file(target)) await copy(target, to, remap);
        }
      }
      mapped.push({ ...r, target: relative(dest, to) });
    }
    out.file(relsPath(dest), writeRels(mapped));
  };

  const oursPres = await ours.file(PRES)!.async('string');
  const oursPresRels = await rels(ours, PRES);
  const order = [...oursPres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) =>
    resolveTarget(PRES, oursPresRels.find((r) => r.id === m[1])!.target),
  );
  if (!notesMaster) {
    const ourNm = oursPresRels.find((r) => r.type === T_NOTES_MASTER);
    if (ourNm) {
      const src = resolveTarget(PRES, ourNm.target);
      await copy(src, 'ppt/notesMasters/sc-notesMaster1.xml', () => undefined);
      notesMaster = {
        id: nextRid(),
        type: T_NOTES_MASTER,
        target: 'notesMasters/sc-notesMaster1.xml',
        external: false,
      };
      presRels.push(notesMaster);
      pres = pres.replace(
        /(<\/p:sldMasterIdLst>)/,
        `$1<p:notesMasterIdLst><p:notesMasterId r:id="${notesMaster.id}"/></p:notesMasterIdLst>`,
      );
    }
  }
  const nmPath = notesMaster ? resolveTarget(PRES, notesMaster.target) : undefined;

  const sldIds: string[] = [];
  for (const [i, src] of order.entries()) {
    const dest = `ppt/slides/slide${i + 1}.xml`;
    const ourLayout = (await rels(ours, src)).find((r) => typeOf(r.type) === 'slideLayout');
    const layoutXml = ourLayout
      ? await ours.file(resolveTarget(src, ourLayout.target))!.async('string')
      : '';
    const role = (/<p:cSld name="([^"]+)"/.exec(layoutXml)?.[1] ??
      'content') as keyof TemplateLayouts;
    const layout = layouts[role] ?? layouts.content;
    await copy(src, dest, (r, target) => {
      const kind = typeOf(r.type);
      if (kind === 'slideLayout') return layout;
      if (kind === 'notesMaster') return nmPath;
      if (kind === 'slide') return copied.get(target) ?? dest;
      return undefined;
    });
    // the layout's slide number and footer placeholders
    const tLayoutXml = await out.file(layout)!.async('string');
    const slideXml = await out.file(dest)!.async('string');
    const footer = role === 'cover' ? undefined : opts.footer;
    let placeholders = placeholderShapes(tLayoutXml, i + 1, footer, 9000);
    // Some brand layouts have no footer placeholder. Retain the generated
    // editable footer shape instead of losing it when we replace the master.
    if (footer && !placeholders.includes('name="Footer"')) {
      const escaped = footer.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const shape = [...layoutXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
        .map((m) => m[0])
        .find(
          (sp) => [...sp.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('') === escaped,
        );
      if (shape)
        placeholders += shape.replace(/(<p:cNvPr\s+id=")\d+("[^>]*name=")[^"]*/, '$19001$2Footer');
    }
    out.file(dest, slideXml.replace('</p:spTree>', `${placeholders}</p:spTree>`));
    const rid = nextRid();
    presRels.push({ id: rid, type: T_SLIDE, target: `slides/slide${i + 1}.xml`, external: false });
    sldIds.push(`<p:sldId id="${256 + i}" r:id="${rid}"/>`);
  }
  pres = pres.replace(/(<p:sldSz\b)/, `<p:sldIdLst>${sldIds.join('')}</p:sldIdLst>$1`);
  const ourSize = /<p:sldSz [^>]*cx="(\d+)" cy="(\d+)"/.exec(oursPres);
  const tSize = /<p:sldSz [^>]*cx="(\d+)" cy="(\d+)"/.exec(pres);
  if (ourSize && tSize && (ourSize[1] !== tSize[1] || ourSize[2] !== tSize[2]))
    notes.push(
      'Template slide size differs from the deck format; use the format file from `theme import`.',
    );
  out.file(PRES, pres);
  out.file(relsPath(PRES), writeRels(presRels));
  // document properties are the deck's, not the template's
  for (const p of ['docProps/core.xml', 'docProps/app.xml']) {
    const f = ours.file(p);
    if (f) out.file(p, await f.async('uint8array'));
  }
  out.file('[Content_Types].xml', writeTypes(types));
  const buf = await out.generateAsync({ type: 'nodebuffer' });
  return { buf, notes };
}
