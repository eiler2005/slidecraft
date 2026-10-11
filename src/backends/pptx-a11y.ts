/**
 * Accessibility post-processing for PPTX parts (both PPTX engines):
 *  - the shape named TITLE_NAME becomes the slide's title placeholder;
 *  - the title is moved to the front of the shape tree, so it is read first;
 *  - pictures without real alt text are marked decorative (and never carry a file path).
 */
export const TITLE_NAME = 'SlideCraft Title';

/**
 * Shape name for a text box that came from a deck field: "sc:<slide id>/<field>", e.g.
 * "sc:market/tiles/0/value". `slidecraft sync` reads these names back from an edited PPTX,
 * so edits land in the right field even after slides were reordered. The title keeps
 * TITLE_NAME in front (it becomes the title placeholder).
 */
export function shapeName(
  t: { pointer?: string; role?: string },
  slideId: string | undefined,
): string | undefined {
  if (t.role === 'title') return slideId ? `${TITLE_NAME} sc:${slideId}/title` : TITLE_NAME;
  if (!t.pointer || !slideId) return undefined;
  const m = /^\/slides\/\d+(\/.+)$/.exec(t.pointer);
  return m ? `sc:${slideId}${m[1]}` : undefined;
}

// Inserted elements declare their own namespace: some writers (artifact-tool) declare
// `a:` per element instead of on the root.
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const DECORATIVE_EXT =
  '<a:extLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}"><adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/></a:ext></a:extLst>';

/** A descr that is not alt text: empty, a file path or an engine's placeholder name. */
const notAlt = (d: string) =>
  !d.trim() ||
  /^(\/|[A-Za-z]:\\|\.{0,2}\/)/.test(d) ||
  /^[\w.-]+\.(png|jpe?g|gif|svg|emf|wmf)$/i.test(d);

export function markTitle(xml: string): string {
  if (!xml.includes(TITLE_NAME)) return xml;
  return xml.replace(
    new RegExp(
      `(<p:cNvPr [^>]*name="${TITLE_NAME}[^"]*"[^>]*?(?:/>|>[\\s\\S]*?</p:cNvPr>))\\s*(?:<p:cNvSpPr[^>]*/>|<p:cNvSpPr[^>]*>[\\s\\S]*?</p:cNvSpPr>)\\s*(?:<p:nvPr\\s*/>|<p:nvPr>\\s*</p:nvPr>)`,
    ),
    `$1<p:cNvSpPr><a:spLocks ${A} noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr>`,
  );
}

export function titleFirst(xml: string): string {
  const tree = /(<p:spTree>[\s\S]*?<\/p:grpSpPr>)([\s\S]*)(<\/p:spTree>)/.exec(xml);
  if (!tree) return xml;
  const body = tree[2]!;
  const at = body.indexOf('<p:ph type="title"/>');
  if (at < 0) return xml;
  const start = body.lastIndexOf('<p:sp>', at);
  const end = body.indexOf('</p:sp>', at);
  if (start < 0 || end < 0 || start === 0) return xml;
  const shape = body.slice(start, end + 7);
  const rest = body.slice(0, start) + body.slice(end + 7);
  return xml.replace(tree[0], `${tree[1]}${shape}${rest}${tree[3]}`);
}

export function markDecorative(xml: string): string {
  return xml.replace(/<p:pic>([\s\S]*?)<\/p:pic>/g, (pic) => {
    const open = /<p:cNvPr ([^>]*?)(\/?)>/.exec(pic);
    if (!open || pic.includes('adec:decorative')) return pic;
    const d = /descr="([^"]*)"/.exec(open[1]!)?.[1] ?? '';
    if (!notAlt(d)) return pic;
    const attrs = open[1]!.replace(/\s*descr="[^"]*"/, '').trimEnd();
    if (open[2])
      return pic.replace(open[0], `<p:cNvPr ${attrs} descr="">${DECORATIVE_EXT}</p:cNvPr>`);
    // extLst is the last child of cNvPr
    return pic
      .replace(open[0], `<p:cNvPr ${attrs} descr="">`)
      .replace('</p:cNvPr>', `${DECORATIVE_EXT}</p:cNvPr>`);
  });
}
