import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/build.ts';
import { readPptx, syncPptx } from '../src/library/sync.ts';

const ROOT = join(import.meta.dirname, '..');

async function edit(file: string, out: string, fn: (zip: JSZip) => Promise<void>) {
  const zip = await JSZip.loadAsync(readFileSync(file));
  await fn(zip);
  writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer' }));
}
const replaceIn = async (zip: JSZip, part: string, from: string, to: string) => {
  const xml = await zip.file(part)!.async('string');
  if (!xml.includes(from)) throw new Error(`"${from}" not in ${part}`);
  zip.file(part, xml.replace(from, to));
};

describe('edits flow back from PowerPoint', () => {
  it('maps edited text to its field, keeps comments and reports what it cannot carry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-sync-'));
    cpSync(join(ROOT, 'examples/pitch-deck/deck.yaml'), join(dir, 'deck.yaml'));
    const deck = join(dir, 'deck.yaml');
    // speaker notes on one slide, to edit them too
    writeFileSync(
      deck,
      readFileSync(deck, 'utf8').replace(
        '    sources: [market-est]\n\n  - id: traction',
        '    sources: [market-est]\n    notes: Stress that the serviceable market is our focus.\n\n  - id: traction',
      ),
    );
    const res = await buildDeck(deck, { formats: ['pptx'], outDir: join(dir, 'dist') });
    const pptx = (res as { files: { path: string; kind: string }[] }).files.find(
      (f) => f.kind === 'pptx',
    )!.path;
    const slides = readPptx(pptx);
    expect(slides.map((s) => s.id)).toEqual([
      'cover',
      'problem',
      'solution',
      'market',
      'traction',
      'competition',
      'model',
      'team',
      'ask',
      'close',
    ]);

    const edited = join(dir, 'edited.pptx');
    await edit(pptx, edited, async (zip) => {
      // a new title on the market slide
      await replaceIn(zip, 'ppt/slides/slide4.xml', 'is a €14B market', 'is a €15B market');
      // one bullet edited, one added, in the traction takeaway
      const xml = await zip.file('ppt/slides/slide5.xml')!.async('string');
      zip.file(
        'ppt/slides/slide5.xml',
        xml
          .replace(
            '68% of bookings come from returning shippers',
            '70% of bookings come from returning shippers',
          )
          .replace(
            /(<a:p>(?:(?!<a:p>)[\s\S])*?Gross margin per load reached 21% in September[\s\S]*?<\/a:p>)/,
            '$1<a:p><a:r><a:t>Referrals bring one in four new shippers</a:t></a:r></a:p>',
          ),
      );
      // the notes
      const notes = Object.keys(zip.files).filter((f) =>
        /notesSlides\/notesSlide\d+\.xml$/.test(f),
      );
      for (const n of notes) {
        const x = await zip.file(n)!.async('string');
        if (x.includes('Stress that the serviceable market'))
          zip.file(
            n,
            x.replace(
              'Stress that the serviceable market is our focus.',
              'Say that SAM, not TAM, is our focus.',
            ),
          );
      }
      // swap two slides in the presentation order
      const pres = await zip.file('ppt/presentation.xml')!.async('string');
      const ids = [...pres.matchAll(/<p:sldId [^>]*\/>/g)].map((m) => m[0]);
      zip.file(
        'ppt/presentation.xml',
        pres.replace(ids[1]!, '§').replace(ids[2]!, ids[1]!).replace('§', ids[2]!),
      );
    });

    const preview = syncPptx(deck, edited);
    expect(preview.changes.map((c) => [c.slide, c.pointer, c.after])).toEqual([
      [
        'market',
        '/slides/3/title',
        'Regional part-load freight is a €15B market in our first three countries',
      ],
      ['market', '/slides/3/notes', 'Say that SAM, not TAM, is our focus.'],
      [
        'traction',
        '/slides/4/takeaway/points',
        [
          '70% of bookings come from returning shippers',
          'Gross margin per load reached 21% in September',
          'Referrals bring one in four new shippers',
        ],
      ],
    ]);
    expect(preview.notes.join('\n')).toMatch(/reordered/);
    expect(readFileSync(deck, 'utf8')).toContain('€14B market'); // preview writes nothing

    const r = syncPptx(deck, edited, { apply: true });
    expect(r.applied).toBe(3);
    const yaml = readFileSync(deck, 'utf8');
    expect(yaml).toContain(
      'title: Regional part-load freight is a €15B market in our first three countries',
    );
    expect(yaml).toContain('Referrals bring one in four new shippers');
    expect(yaml).toContain('# Fictional example: Fabrikam Freight'); // comments kept
    // a second sync against the same file finds nothing new
    expect(syncPptx(deck, edited).changes).toEqual([]);
  }, 60_000);

  it('falls back to slide order and box position when an app dropped the shape names', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-sync3-'));
    const deck = join(dir, 'deck.yaml');
    cpSync(join(ROOT, 'examples/pitch-deck/deck.yaml'), deck);
    const res = await buildDeck(deck, { formats: ['pptx'], outDir: join(dir, 'dist') });
    const pptx = res.files.find((f) => f.kind === 'pptx')!.path;
    const edited = join(dir, 'keynote.pptx');
    await edit(pptx, edited, async (zip) => {
      for (const f of Object.keys(zip.files).filter((n) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(n),
      )) {
        const xml = await zip.file(f)!.async('string');
        zip.file(f, xml.replace(/name="(?:SlideCraft Title )?sc:[^"]*"/g, 'name="TextBox"'));
      }
      await replaceIn(zip, 'ppt/slides/slide4.xml', 'is a €14B market', 'is a €15B market');
    });
    const r = syncPptx(deck, edited);
    expect(r.notes[0]).toMatch(/no SlideCraft shape names/);
    expect(r.changes.map((c) => [c.slide, c.pointer])).toEqual([['market', '/slides/3/title']]);
  }, 60_000);

  it('never overwrites text the deck derives (capitals, facts)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-sync2-'));
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      `schemaVersion: 1
id: s
title: Sync
theme: consulting-classic
facts:
  rev: { value: 42000000, format: "€#,##0.0,,M" }
sources: [{ id: plan, title: Plan, illustrative: true }]
slides:
  - id: q
    layout: matrix-2x2
    variant: quadrants
    title: Revenue reaches {{rev}} when we lead in mid-market
    xAxis: { label: Ability to win, low: Weak, high: Strong }
    yAxis: { label: Attractiveness, low: Low, high: High }
    quadrants:
      - { name: Build, note: Enterprise is large but owned by incumbents }
      - { name: Lead here, note: Mid-market grows fastest }
      - { name: Avoid, note: Micro-business pays little }
      - { name: Serve, note: Public sector via partners }
    sources: [plan]
`,
    );
    const res = await buildDeck(deck, { formats: ['pptx'], outDir: join(dir, 'dist') });
    const pptx = (res as { files: { path: string; kind: string }[] }).files.find(
      (f) => f.kind === 'pptx',
    )!.path;
    const edited = join(dir, 'edited.pptx');
    await edit(pptx, edited, async (zip) => {
      await replaceIn(zip, 'ppt/slides/slide1.xml', 'LEAD HERE', 'LEAD THERE');
      await replaceIn(zip, 'ppt/slides/slide1.xml', 'when we lead', 'once we lead');
      await replaceIn(
        zip,
        'ppt/slides/slide1.xml',
        'Mid-market grows fastest',
        'Mid-market grows fastest, 12% a year',
      );
    });
    const r = syncPptx(deck, edited);
    expect(r.changes.map((c) => c.pointer)).toEqual(['/slides/0/quadrants/1/note']);
    expect(r.skipped.map((s) => [s.pointer, s.reason.split(' — ')[0]])).toEqual([
      ['/slides/0/title', 'the text uses {{facts}}'],
      ['/slides/0/quadrants/1/name', 'the slide shows this text transformed (e.g. in capitals)'],
    ]);
  }, 60_000);

  it('runs from the command line', () => {
    const out = execFileSync(
      process.execPath,
      ['--import', 'tsx', join(ROOT, 'src/cli/main.ts'), 'sync', '--help'],
      { encoding: 'utf8', cwd: ROOT },
    );
    expect(out).toContain('--apply');
  });
});
