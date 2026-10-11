// Writes model.xlsx: a minimal real workbook (shared strings, numbers, a formula with a cached value).
import { writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const zip = new JSZip();
const strings = ['Year', 'UK', 'Germany', 'Revenue 2028'];
zip.file(
  '[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
);
zip.file(
  '_rels/.rels',
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
);
zip.file(
  'xl/workbook.xml',
  '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Plan" sheetId="1" r:id="rId1"/></sheets></workbook>',
);
zip.file(
  'xl/_rels/workbook.xml.rels',
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
);
zip.file(
  'xl/sharedStrings.xml',
  `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`,
);
const row = (r, cells) => `<row r="${r}">${cells.join('')}</row>`;
const s = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
const n = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
const f = (ref, formula, v) => `<c r="${ref}"><f>${formula}</f><v>${v}</v></c>`;
zip.file(
  'xl/worksheets/sheet1.xml',
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[
    row(1, [s('A1', 0), s('B1', 1), s('C1', 2)]),
    row(2, [n('A2', 2026), n('B2', 42), n('C2', 0)]),
    row(3, [n('A3', 2027), n('B3', 49), n('C3', 12)]),
    row(4, [n('A4', 2028), n('B4', 58), n('C4', 40)]),
    row(6, [s('A6', 3), f('B6', 'C4*1000000', 40000000)]),
  ].join('')}</sheetData></worksheet>`,
);
writeFileSync(
  new URL('./model.xlsx', import.meta.url),
  await zip.generateAsync({ type: 'nodebuffer' }),
);
