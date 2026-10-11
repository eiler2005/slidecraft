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

export async function pdfPages(data: Uint8Array): Promise<PdfText> {
  const pdfjs: Any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Node: run pdf.js's worker in this thread ("fake worker") instead of loading a file
  (globalThis as Any).pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
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
  await doc.destroy();
  const date = /^D:(\d{4})(\d{2})?/.exec(String(info.CreationDate ?? ''));
  return {
    pages,
    ...(info.Title ? { title: String(info.Title) } : {}),
    ...(info.Author ? { author: String(info.Author) } : {}),
    ...(date ? { date: date[2] ? `${date[1]}-${date[2]}` : date[1] } : {}),
  };
}
