import PDFDocument from 'pdfkit';
import { describe, expect, it } from 'vitest';
import { pdfPages, pdfStyle } from '../src/library/pdf-text.ts';

async function sample() {
  const doc = new PDFDocument({
    size: [400, 300],
    margin: 0,
    info: { Title: 'Synthetic PDF regression', Author: 'SlideCraft regression' },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.rect(0, 0, 400, 300).fill('#FAFAF7');
  doc.rect(20, 20, 120, 10).fill('#1F5FBF');
  doc.rect(20, 45, 60, 10).stroke('#B23A3A');
  doc.fillColor('#14213D').font('Helvetica').fontSize(16).text('First page evidence', 20, 90);
  doc.addPage().text('Second page evidence', 20, 90);
  doc.end();
  return done;
}

describe('PDF reader lifecycle and operator semantics', () => {
  it('preserves page boundaries and metadata across repeated reads', async () => {
    const data = await sample();
    for (let i = 0; i < 2; i++) {
      const result = await pdfPages(new Uint8Array(data));
      expect(result.pages).toEqual(['First page evidence', 'Second page evidence']);
      expect(result.title).toBe('Synthetic PDF regression');
      expect(result.author).toBe('SlideCraft regression');
    }
  });

  it('measures filled areas and text colours without counting stroked outlines', async () => {
    const result = await pdfStyle(new Uint8Array(await sample()), 1);
    expect(result.page).toEqual({ w: 400, h: 300 });
    expect(result.fills.find((v) => v.hex === '#FAFAF7')?.area).toBe(120000);
    expect(result.fills.find((v) => v.hex === '#1F5FBF')?.area).toBe(1200);
    expect(result.fills.some((v) => v.hex === '#B23A3A')).toBe(false);
    expect(result.text.find((v) => v.hex === '#14213D')?.chars).toBeGreaterThan(10);
    expect(result.fonts.some((v) => v.maxSize === 16 && v.chars > 10)).toBe(true);
    expect(result.margins?.l).toBeCloseTo(0.05);
  });

  it('reports malformed PDF input and permits a later valid read', async () => {
    for (const read of [pdfPages, pdfStyle]) {
      await expect(read(new TextEncoder().encode('not a PDF'))).rejects.toThrow();
      const data = await sample();
      expect((await pdfPages(new Uint8Array(data))).pages).toHaveLength(2);
    }
  });
});
