/**
 * PDF text by page, with pdf.js (Apache-2.0). Bundled separately as dist/pdf-text.mjs and
 * loaded only when a PDF is ingested, so the main CLI stays small.
 */
// biome-ignore lint/suspicious/noExplicitAny: pdf.js ships loose types for the legacy build
type Any = any;

export interface PdfText {
  pages: string[];
  title?: string;
  author?: string;
  date?: string;
}

/** The loading task owns the worker in PDF.js 6; always release it, including on errors. */
async function withPdf<T>(
  data: Uint8Array,
  read: (doc: Any, pdfjs: Any) => Promise<T>,
): Promise<T> {
  const pdfjs: Any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Node: run pdf.js's worker in this thread ("fake worker") instead of loading a file
  (globalThis as Any).pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    return await read(await task.promise, pdfjs);
  } finally {
    await task.destroy();
  }
}

export async function pdfPages(data: Uint8Array): Promise<PdfText> {
  return withPdf(data, async (doc) => {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
        if (item.str === undefined) continue;
        text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(
        text
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim(),
      );
    }
    const meta: Any = await doc.getMetadata().catch(() => ({}));
    const info = meta?.info ?? {};
    const date = /^D:(\d{4})(\d{2})?/.exec(String(info.CreationDate ?? ''));
    return {
      pages,
      ...(info.Title ? { title: String(info.Title) } : {}),
      ...(info.Author ? { author: String(info.Author) } : {}),
      ...(date ? { date: date[2] ? `${date[1]}-${date[2]}` : date[1] } : {}),
    };
  });
}

export interface PdfStyle {
  /** Page size in points (first page). */
  page: { w: number; h: number };
  /** Filled areas by colour, in square points. */
  fills: { hex: string; area: number }[];
  /** Text colours by number of glyphs. */
  text: { hex: string; chars: number }[];
  /** Fonts by glyphs drawn, with the largest size seen. */
  fonts: { name: string; chars: number; maxSize: number }[];
  /** Text extent as fractions of the page: left, right, top and bottom margins. */
  margins?: { l: number; r: number; t: number; b: number };
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Colours, fonts and margins of a PDF (a reference deck, a brand guide), first pages only. */
export async function pdfStyle(data: Uint8Array, maxPages = 6): Promise<PdfStyle> {
  return withPdf(data, async (doc, pdfjs) => {
    const OPS = pdfjs.OPS;
    const fills = new Map<string, number>();
    const text = new Map<string, number>();
    const fonts = new Map<string, { chars: number; maxSize: number }>();
    let page0 = { w: 0, h: 0 };
    const ext = { l: 1, r: 0, t: 1, b: 0 };
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const page = await doc.getPage(p);
      const [x0, y0, x1, y1] = page.view as number[];
      const W = x1! - x0!;
      const H = y1! - y0!;
      if (p === 1) page0 = { w: W, h: H };
      const ops = await page.getOperatorList();
      let fill = '#000000';
      let box: ArrayLike<number> | undefined;
      const addFill = () => {
        if (!box) return;
        const area = Math.abs((box[2]! - box[0]!) * (box[3]! - box[1]!));
        if (Number.isFinite(area)) fills.set(fill, (fills.get(fill) ?? 0) + area);
      };
      let font = '';
      let size = 0;
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const a = ops.argsArray[i];
        if (fn === OPS.setFillRGBColor)
          fill =
            typeof a[0] === 'string'
              ? a[0].toUpperCase()
              : `#${hex2(a[0])}${hex2(a[1])}${hex2(a[2])}`.toUpperCase();
        else if (fn === OPS.setFillGray) fill = `#${hex2(a[0] * 255).repeat(3)}`.toUpperCase();
        else if (fn === OPS.constructPath) {
          box = a[2];
          // PDF.js 6 folds the paint operation into constructPath's first argument.
          if ([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke].includes(a[0])) addFill();
        } else if (
          fn === OPS.fill ||
          fn === OPS.eoFill ||
          fn === OPS.fillStroke ||
          fn === OPS.eoFillStroke
        ) {
          addFill();
        } else if (fn === OPS.setFont) {
          font = a[0];
          size = a[1];
        } else if (fn === OPS.showText) {
          const n = (a[0] as { unicode?: string }[]).filter((g) => g?.unicode?.trim()).length;
          text.set(fill, (text.get(fill) ?? 0) + n);
          let name = font;
          try {
            name = page.commonObjs.get(font)?.name ?? font;
          } catch {
            // font not resolved
          }
          name = String(name)
            .replace(/^[A-Z]{6}\+/, '')
            .replace(
              /[-,](Bold|Italic|Regular|Oblique|BoldItalic|BoldMT|MT|PSMT|Roman|Book|Medium|Light|SemiBold|Semibold|Black)+$/i,
              '',
            )
            .replace(/(PSMT|MT)$/, '');
          const f = fonts.get(name) ?? { chars: 0, maxSize: 0 };
          f.chars += n;
          f.maxSize = Math.max(f.maxSize, Math.abs(size));
          fonts.set(name, f);
        }
      }
      const tc = await page.getTextContent();
      for (const it of tc.items as {
        str?: string;
        transform: number[];
        width: number;
        height: number;
      }[]) {
        if (!it.str?.trim()) continue;
        const x = it.transform[4]! - x0!;
        const y = it.transform[5]! - y0!;
        ext.l = Math.min(ext.l, x / W);
        ext.r = Math.max(ext.r, (x + it.width) / W);
        ext.t = Math.min(ext.t, 1 - (y + it.height) / H);
        ext.b = Math.max(ext.b, 1 - y / H);
      }
    }
    const sorted = <T>(m: Map<string, T>, k: (v: T) => number) =>
      [...m].sort((a, b) => k(b[1]) - k(a[1]));
    return {
      page: page0,
      fills: sorted(fills, (v) => v).map(([hex, area]) => ({ hex, area })),
      text: sorted(text, (v) => v).map(([hex, chars]) => ({ hex, chars })),
      fonts: sorted(fonts, (v) => v.chars).map(([name, v]) => ({ name, ...v })),
      ...(ext.r > ext.l ? { margins: { l: ext.l, r: 1 - ext.r, t: ext.t, b: 1 - ext.b } } : {}),
    };
  });
}
