/**
 * DOCX engine: the deck as an editable Word memo, written as plain OOXML (no dependency).
 *
 * Per slide: the action title as Heading 1; text slides as editable paragraphs and bullets;
 * tables as Word tables; exhibits (charts, diagrams, matrices) as the slide image with alt
 * text; then the source line (with links) and speaker notes. Headings give Word's
 * navigation pane the same title chain as the deck.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import type { Paragraph, Scene, SceneSlide, TableNode, TextNode } from '../engine/scene.ts';
import { VERSION } from '../paths.ts';
import { rasterize } from './resvg.ts';
import { slideSvg } from './svg.ts';
import type { Engine } from './types.ts';

const TEXT_LAYOUTS = new Set([
  'exec-summary',
  'key-points',
  'big-statement',
  'text',
  'next-steps',
  'agenda',
  'title',
]);
const SKIP_ROLES = new Set([
  'title',
  'tracker',
  'footer',
  'source',
  'decor',
  'quote-mark',
  'chart-label',
  'ghost',
  'ghost-note',
  'logo',
]);
const EMU = 914400;
const IMG_W = 6.3;

const x = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c: string) => c.replace('#', '').toUpperCase();

class Doc {
  body: string[] = [];
  rels: string[] = [];
  media: { name: string; data: Buffer }[] = [];
  private rid = 10;
  private pic = 1;

  link(url: string): string {
    const id = `rId${this.rid++}`;
    this.rels.push(
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(url)}" TargetMode="External"/>`,
    );
    return id;
  }

  runs(p: Paragraph, extra = ''): string {
    return p.runs
      .map((r) => {
        const rpr = `${r.bold ? '<w:b/>' : ''}${r.italic ? '<w:i/>' : ''}${extra}`;
        const run = (style = '') =>
          `<w:r>${rpr || style ? `<w:rPr>${style}${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(r.text)}</w:t></w:r>`;
        return r.link
          ? `<w:hyperlink r:id="${this.link(r.link)}">${run('<w:rStyle w:val="Hyperlink"/>')}</w:hyperlink>`
          : run();
      })
      .join('');
  }

  para(style: string, content: string, keepNext = false) {
    this.body.push(
      `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepNext ? '<w:keepNext/>' : ''}</w:pPr>${content}</w:p>`,
    );
  }

  plain(style: string, text: string) {
    this.para(style, `<w:r><w:t xml:space="preserve">${x(text)}</w:t></w:r>`);
  }

  text(t: TextNode) {
    for (const p of t.paragraphs) {
      if (!p.runs.some((r) => r.text.trim())) continue;
      const plain = p.runs.map((r) => r.text).join('');
      const label = /^[\p{Lu}\d][\p{Lu}\d &/·–-]{2,40}$/u.test(plain);
      const style =
        t.role === 'lead' ? 'Lead' : label ? 'Tracker' : p.bullet ? 'ListBullet' : 'BodyText';
      this.para(style, this.runs(p));
    }
  }

  table(n: TableNode, pal: NonNullable<Scene['palette']>) {
    const total = n.colW.reduce((a, b) => a + b, 0);
    const widths = n.colW.map((w) => Math.round((w / total) * IMG_W * 1440));
    const rows = n.cells
      .map(
        (row, ri) =>
          `<w:tr>${ri === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${row
            .map(
              (c, ci) =>
                `<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>${ri === 0 ? `<w:shd w:val="clear" w:color="auto" w:fill="${hex(pal.surface)}"/>` : ''}</w:tcPr>${
                  c.text.paragraphs
                    .map(
                      (p) =>
                        `<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${this.runs(p, ri === 0 ? '<w:b/>' : '')}</w:p>`,
                    )
                    .join('') || '<w:p/>'
                }</w:tc>`,
            )
            .join('')}</w:tr>`,
      )
      .join('');
    const b = (side: string) =>
      `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${hex(pal.rule)}"/>`;
    this.body.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(IMG_W * 1440)}" w:type="dxa"/><w:tblBorders>${b('top')}${b('bottom')}${b('insideH')}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`,
      '<w:p/>',
    );
  }

  image(data: Buffer, wIn: number, hIn: number, alt: string) {
    const n = this.pic++;
    const name = `slide${n}.png`;
    const id = `rId${this.rid++}`;
    this.media.push({ name, data });
    this.rels.push(
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`,
    );
    const cx = Math.round(wIn * EMU);
    const cy = Math.round(hIn * EMU);
    this.body.push(
      `<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Slide ${n}" descr="${x(alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}" descr="${x(alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="6350"><a:solidFill><a:srgbClr val="D0D5DD"/></a:solidFill></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`,
    );
  }
}

function styles(scene: Scene): string {
  const pal = scene.palette!;
  const head = scene.fonts?.heading.family ?? 'Arial';
  const body = scene.fonts?.body.family ?? 'Arial';
  const st = (id: string, name: string, ppr: string, rpr: string, based = 'Normal') =>
    `<w:style w:type="paragraph" w:customStyle="${/^(Title|Subtitle|Heading1|ListBullet|BodyText|Caption)$/.test(id) ? 0 : 1}" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${based}"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${body}" w:hAnsi="${body}" w:cs="${body}" w:eastAsia="${body}"/><w:sz w:val="21"/><w:color w:val="${hex(pal.ink)}"/><w:lang w:val="${x(scene.language)}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${st('Title', 'Title', '<w:spacing w:after="160"/>', `<w:rFonts w:ascii="${head}" w:hAnsi="${head}"/><w:b/><w:sz w:val="52"/>`)}${st('Subtitle', 'Subtitle', '<w:spacing w:after="240"/>', `<w:color w:val="${hex(pal.muted)}"/><w:sz w:val="26"/>`)}${st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/>', `<w:rFonts w:ascii="${head}" w:hAnsi="${head}"/><w:b/><w:sz w:val="30"/>`)}${st('Tracker', 'Tracker', '<w:keepNext/><w:spacing w:before="320" w:after="0"/>', `<w:b/><w:caps/><w:color w:val="${hex(pal.accent)}"/><w:sz w:val="16"/>`)}${st('Lead', 'Lead', '', `<w:i/><w:color w:val="${hex(pal.muted)}"/><w:sz w:val="22"/>`)}${st('BodyText', 'Body Text', '', '')}${st('ListBullet', 'List Bullet', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="80"/>', '')}${st('TableText', 'Table Text', '<w:spacing w:after="0"/>', '<w:sz w:val="19"/>')}${st('Figure', 'Figure', '<w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/>', '')}${st('Source', 'Source', '<w:spacing w:after="120"/>', `<w:color w:val="${hex(pal.muted)}"/><w:sz w:val="16"/>`)}${st('Notes', 'Speaker Notes', `<w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="${hex(pal.rule)}"/></w:pBdr><w:ind w:left="200"/>`, `<w:color w:val="${hex(pal.muted)}"/><w:sz w:val="19"/>`)}<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${hex(pal.accent)}"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
}

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

export async function renderDocx(scene: Scene, epoch: Date): Promise<Buffer> {
  const pal = scene.palette ?? {
    background: '#FFFFFF',
    ink: '#111111',
    muted: '#666666',
    accent: '#1F4E9E',
    rule: '#D0D5DD',
    surface: '#F2F4F7',
  };
  const d = new Doc();
  const ratio = scene.format.h / scene.format.w;
  const textOf = (s: SceneSlide, role: string) =>
    s.nodes
      .filter((n): n is TextNode => n.kind === 'text' && n.role === role)
      .map((n) => n.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' '))
      .join(' ');

  for (const [i, s] of scene.slides.entries()) {
    if (i === 0 && s.layout === 'title') {
      d.plain('Title', s.title);
      const sub = scene.meta?.subtitle;
      if (sub) d.plain('Subtitle', sub);
      const by = [scene.author, scene.meta?.organization, scene.meta?.date].filter(Boolean);
      if (by.length) d.plain('Source', by.join(' · '));
      continue;
    }
    const tracker = textOf(s, 'tracker');
    if (tracker) d.plain('Tracker', tracker);
    d.para('Heading1', `<w:r><w:t xml:space="preserve">${x(s.title)}</w:t></w:r>`);
    const tables = s.nodes.filter((n): n is TableNode => n.kind === 'table');
    if (TEXT_LAYOUTS.has(s.layout)) {
      for (const n of s.nodes) if (n.kind === 'text' && !SKIP_ROLES.has(n.role ?? '')) d.text(n);
    } else if (s.layout === 'data-table' && tables.length) {
      for (const n of s.nodes) if (n.kind === 'text' && n.role === 'lead') d.text(n);
      for (const t of tables) d.table(t, pal);
    } else {
      for (const n of s.nodes) if (n.kind === 'text' && n.role === 'lead') d.text(n);
      const png = await rasterize(slideSvg(scene, s), 1600);
      d.image(png, IMG_W, IMG_W * ratio, s.title);
    }
    for (const n of s.nodes)
      if (n.kind === 'text' && n.role === 'source')
        for (const p of n.paragraphs) d.para('Source', d.runs(p));
    if (s.notes)
      for (const line of s.notes.split(/\n+/).filter((l) => l.trim())) d.plain('Notes', line);
  }

  const iso = epoch.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const zip = new JSZip();
  const add = (name: string, data: string | Buffer) =>
    zip.file(name, data, { date: epoch, createFolders: false });
  add(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  add(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  add(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(scene.title)}</dc:title><dc:creator>${x(scene.author ?? 'SlideCraft')}</dc:creator><dc:language>${x(scene.language)}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`,
  );
  add(
    'docProps/app.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SlideCraft ${VERSION}</Application></Properties>`,
  );
  add('word/styles.xml', styles({ ...scene, palette: pal }));
  add('word/numbering.xml', NUMBERING);
  add(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${d.rels.join('')}</Relationships>`,
  );
  for (const m of d.media) add(`word/media/${m.name}`, m.data);
  add(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${d.body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1021" w:bottom="1134" w:left="1021" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  });
}

export const docxEngine: Engine = {
  id: 'docx',
  kind: 'docx',
  label: 'Word memo (DOCX)',
  license: 'MIT',
  capabilities: {
    editable: true,
    nativeCharts: false,
    speakerNotes: true,
    fidelity: 'preview',
    install: 'bundled',
    ci: true,
  },
  async detect() {
    return { available: true, detail: 'bundled' };
  },
  async render(scene, opts) {
    mkdirSync(opts.outDir, { recursive: true });
    const p = join(opts.outDir, `${opts.baseName}.docx`);
    writeFileSync(p, await renderDocx(scene, opts.epoch));
    return {
      files: [{ path: p, kind: 'docx', engine: 'docx' }],
      diagnostics: [],
      limitations: [
        'DOCX: text slides and tables are editable; charts and diagrams are slide images with alt text.',
      ],
    };
  },
};
