import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDeck } from '../src/build.ts';
import {
  fetchStock,
  openverseProvider,
  pexelsProvider,
  pickHit,
  planStock,
} from '../src/library/images.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const json = (body: unknown) =>
  ({ ok: true, json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) }) as Response;
/** A JPEG header with an APP0 segment and a SOF0 frame of the given size. */
const jpeg = (w = 2048, h = 1365) =>
  ({
    ok: true,
    arrayBuffer: async () =>
      new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xe0,
        0,
        4,
        1,
        2,
        0xff,
        0xc0,
        0,
        11,
        8,
        h >> 8,
        h & 0xff,
        w >> 8,
        w & 0xff,
        3,
      ]).buffer,
  }) as Response;

const openverseBody = {
  results: [
    {
      url: 'https://img/small.jpg',
      width: 640,
      height: 480,
      creator: 'A',
      license: 'by',
      license_version: '2.0',
      source: 'flickr',
      foreign_landing_url: 'https://flickr/1',
    },
    {
      url: 'https://img/wide.jpg',
      width: 2048,
      height: 1365,
      title: 'Team at work',
      creator: 'Jane Doe',
      license: 'by-sa',
      license_version: '4.0',
      license_url: 'https://cc/by-sa/4.0',
      source: 'flickr',
      foreign_landing_url: 'https://flickr/2',
    },
  ],
};

describe('stock photos', () => {
  it('maps Openverse results to credits and picks a wide landscape photo', async () => {
    let asked = '';
    const p = openverseProvider((async (u: string) => {
      asked = u;
      return json(openverseBody);
    }) as typeof fetch);
    const hits = await p.search('team at work');
    expect(asked).toContain('license_type=commercial%2Cmodification');
    const hit = pickHit(hits)!;
    expect(hit.url).toBe('https://img/wide.jpg');
    expect(hit.credit).toEqual({
      author: 'Jane Doe',
      provider: 'Openverse · Flickr',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://cc/by-sa/4.0',
      source: 'https://flickr/2',
      title: 'Team at work',
    });
  });

  it('maps Wikimedia Commons results and refuses non-commercial licences', async () => {
    const { wikimediaProvider } = await import('../src/library/images.ts');
    const page = (title: string, licence: string, w: number) => ({
      title,
      index: w,
      imageinfo: [
        {
          url: `https://upload/${title}`,
          thumburl: `https://upload/thumb/${title}.jpg/1920px-${title}.jpg`,
          width: w,
          height: Math.round(w / 1.5),
          descriptionurl: `https://commons/${title}`,
          extmetadata: {
            LicenseShortName: { value: licence },
            Artist: { value: '<a href="x">Ada Lovelace</a>' },
            ObjectName: { value: title },
          },
        },
      ],
    });
    const p = wikimediaProvider((async () =>
      json({
        query: {
          pages: {
            1: page('Desk', 'CC BY-SA 4.0', 4000),
            2: page('Office', 'CC BY-NC 2.0', 5000),
            3: page('Laptop', 'Public domain', 1200),
          },
        },
      })) as typeof fetch);
    const hits = await p.search('desk');
    expect(hits.map((h) => h.credit.title)).toEqual(['Laptop', 'Desk']);
    const desk = hits.find((h) => h.credit.title === 'Desk')!;
    expect(desk).toMatchObject({
      url: 'https://upload/thumb/Desk.jpg/1920px-Desk.jpg',
      width: 1920,
    });
    // a rendition never claims more pixels than the original
    expect(hits.find((h) => h.credit.title === 'Laptop')!.width).toBe(1200);
    expect(desk.credit).toMatchObject({
      author: 'Ada Lovelace',
      provider: 'Wikimedia Commons',
      license: 'CC BY-SA 4.0',
    });
  });

  it('needs a key for Pexels', async () => {
    await expect(pexelsProvider({}).search('x')).rejects.toThrow('PEXELS_API_KEY');
  });

  it('downloads the photo, writes image and imageCredit back, and credits it on the slide', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-stock-'));
    dirs.push(dir);
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      `schemaVersion: 1
id: s
title: Stock
theme: consulting-classic
language: en
slides:
  - id: story
    layout: text-image
    title: The team that ships works next to the people who use the software
    body: [Engineers sit with the operations team every day.]
    alt: Engineers and operators at one table
    imageQuery: engineers working with operations team
`,
    );
    const jobs = planStock(deck);
    expect(jobs.map((j) => j.query)).toEqual(['engineers working with operations team']);
    const provider = openverseProvider((async () => json(openverseBody)) as typeof fetch);
    const r = await fetchStock(jobs, provider, (async () => jpeg()) as typeof fetch);
    expect(r.failed).toEqual([]);
    expect(existsSync(join(dir, 'assets/story.jpg'))).toBe(true);
    const yaml = readFileSync(deck, 'utf8');
    expect(yaml).toContain('image: assets/story.jpg');
    expect(yaml).toContain('author: Jane Doe');
    expect(planStock(deck)).toEqual([]);

    const { scene } = checkDeck(deck);
    const s = scene!.slides[0]!;
    const source = s.nodes.find((n) => n.kind === 'text' && n.role === 'source');
    const text =
      source?.kind === 'text'
        ? source.paragraphs.flatMap((p) => p.runs.map((x) => x.text)).join('')
        : '';
    expect(text).toContain('Photo: Jane Doe / Openverse · Flickr, CC BY-SA 4.0');
    expect(s.notes).toContain('[Sources]\n- Photo: Team at work — Jane Doe — Openverse · Flickr');
  });

  it('measures each download and skips a photo whose real size is smaller than listed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-stock-'));
    dirs.push(dir);
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      `schemaVersion: 1
id: s
title: Stock
theme: consulting-classic
language: en
slides:
  - id: story
    layout: text-image
    title: The team that ships works next to the people who use the software
    body: [Engineers sit with the operations team every day.]
    alt: Engineers and operators at one table
    imageQuery: team
`,
    );
    const hit = (url: string, creator: string) => ({
      url,
      width: 7360,
      height: 4912,
      creator,
      license: 'cc0',
      license_version: '1.0',
      source: 'rawpixel',
      foreign_landing_url: url,
    });
    const provider = openverseProvider((async () =>
      json({
        results: [
          hit('https://img/editor_1024.jpg', 'Small'),
          hit('https://img/full.jpg', 'Sharp'),
        ],
      })) as typeof fetch);
    const asked: string[] = [];
    const r = await fetchStock(planStock(deck), provider, (async (u: string) => {
      asked.push(u);
      return u.includes('1024') ? jpeg(1024, 683) : jpeg(2400, 1602);
    }) as typeof fetch);
    expect(r.failed).toEqual([]);
    expect(asked).toEqual(['https://img/editor_1024.jpg', 'https://img/full.jpg']);
    expect(r.found[0]!.credit.author).toBe('Sharp');
  });
});
