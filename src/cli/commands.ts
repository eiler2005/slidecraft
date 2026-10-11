import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import YAML from 'yaml';
import { z } from 'zod';
import { detect, engines } from '../backends/registry.ts';
import type { OutputKind } from '../backends/types.ts';
import { buildDeck, checkDeck } from '../build.ts';
import { isComposable } from '../layouts/composition.ts';
import { LAYOUTS } from '../layouts/index.ts';
import { exhibitRoutes } from '../library/exhibits.ts';
import { loadStorylines, loadThemes } from '../library/load.ts';
import { SCHEMAS_DIR, VERSION } from '../paths.ts';
import { Brief } from '../spec/brief.ts';
import { deckJsonSchema } from '../spec/deck.ts';
import { Storyline } from '../spec/storyline.ts';
import { Theme } from '../spec/theme.ts';
import {
  bold,
  dim,
  EXIT,
  formatDiagnostic,
  green,
  printJson,
  summary,
  wantsJson,
  yellow,
} from './output.ts';

function layoutContract(l: (typeof LAYOUTS)[number]) {
  return {
    id: l.id,
    name: l.name,
    group: l.group,
    purpose: l.purpose,
    useWhen: l.useWhen,
    avoidWhen: l.avoidWhen,
    variants: l.variants,
    frame: l.frame,
    composable: isComposable(l),
    schema: z.toJSONSchema(l.schema, { unrepresentable: 'any' }),
    example: l.examples[0],
  };
}

/** Editors (VS Code, Cursor, JetBrains) validate and autocomplete YAML from this line. */
export const SCHEMA_LINE = (kind: 'brief' | 'deck') =>
  `# yaml-language-server: $schema=https://raw.githubusercontent.com/eiler2005/slidecraft/main/schemas/${kind}.v1.json\n`;

const STOP = new Set(
  'the a an to of for and or our we us you your should must will would can need needs that this these it its is are be been at on in into onto with by from about as so than then'.split(
    ' ',
  ),
);

/** "The board approves a partner-led entry into Germany" → "board-approves-partner-led-entry". */
const CYR: Record<string, string> = Object.fromEntries(
  'а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:y к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:kh ц:ts ч:ch ш:sh щ:shch ъ: ы:y ь: э:e ю:yu я:ya і:i ї:yi є:ye ә:a ғ:g қ:q ң:n ө:o ұ:u ү:u һ:h'
    .split(' ')
    .map((p) => p.split(':') as [string, string]),
);
const CYR_STOP = new Set([
  'kak',
  'my',
  'za',
  'v',
  'na',
  'i',
  'po',
  's',
  'dlya',
  'chto',
  'eto',
  'ne',
]);

export function slugFrom(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => CYR[ch] ?? ch)
    .join('')
    .split(/\s+/)
    .filter((w) => !CYR_STOP.has(w))
    .join(' ')
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .slice(0, 5)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function registerCommands(program: Command): void {
  program.version(VERSION, '-v, --version');
  program
    .command('components')
    .description('List reusable native body exhibits and their existing content contracts')
    .argument('[id]', 'optional existing layout id')
    .option('--json', 'machine-readable contracts')
    .action((id: string | undefined, o: { json?: boolean }) => {
      const list = LAYOUTS.filter((l) => isComposable(l) && (!id || l.id === id));
      if (!list.length) throw new Error(`Unknown or non-composable component: ${id}`);
      if (wantsJson(o.json)) printJson(list.map(layoutContract));
      else list.forEach((l) => console.log(`${l.id}: ${l.purpose}`));
    });
  program
    .command('exhibits')
    .description('Route an intended visual relationship to existing layout contracts')
    .argument('[relationship]', 'e.g. comparison, process, architecture, bridge')
    .option('--json', 'machine-readable output')
    .action((relationship: string | undefined, o: { json?: boolean }) => {
      const routes = exhibitRoutes(relationship);
      if (!routes.length) throw new Error(`Unknown visual relationship: ${relationship}`);
      if (wantsJson(o.json)) printJson(routes);
      else
        for (const route of routes)
          console.log(
            `${route.id}: ${route.question}\n  ${route.layouts.map((l) => l.id).join(', ')}\n  ${route.guard}`,
          );
    });

  program
    .command('validate')
    .description('Validate deck.yaml against the schema and layout contracts')
    .argument('<deck>', 'path to deck.yaml')
    .option('--json', 'machine-readable output')
    .action((deck: string, o: { json?: boolean }) => {
      const r = checkDeck(deck);
      const spec = r.diagnostics.filter((d) => d.code.startsWith('SC-SPEC'));
      if (wantsJson(o.json))
        printJson({ ok: !spec.some((d) => d.severity === 'error'), diagnostics: spec });
      else {
        spec.forEach((d) => console.log(formatDiagnostic(d)));
        console.log(
          spec.length
            ? summary(spec)
            : green(`✔ ${deck} is valid (${r.loaded.slides.length} slides)`),
        );
      }
      process.exitCode = spec.some((d) => d.severity === 'error') ? EXIT.deckErrors : EXIT.ok;
    });

  program
    .command('check')
    .description(
      'Validate, lay out and run QA (fit, titles, sources, geometry, contrast) without writing files',
    )
    .argument('<deck>', 'path to deck.yaml')
    .option('--json', 'machine-readable output')
    .action((deck: string, o: { json?: boolean }) => {
      const r = checkDeck(deck);
      const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
      if (wantsJson(o.json))
        printJson({
          ok: errors === 0,
          slides: r.scene?.slides.length ?? 0,
          diagnostics: r.diagnostics,
        });
      else {
        r.diagnostics.forEach((d) => console.log(formatDiagnostic(d)));
        console.log(`\n${summary(r.diagnostics)} · ${r.scene?.slides.length ?? 0} slides`);
      }
      process.exitCode = errors ? EXIT.deckErrors : EXIT.ok;
    });

  program
    .command('build')
    .description('Build the deck into PPTX / PDF / PNG / HTML')
    .argument('<deck>', 'path to deck.yaml')
    .option('-f, --format <list>', 'comma-separated: pptx,pdf,png,html,onepager,docx')
    .option('--pptx-engine <id>', 'auto | pptxgenjs | artifact-tool')
    .option('--pdf-engine <id>', 'auto | native | html | pptx-convert')
    .option(
      '--png-engine <id>',
      'auto | resvg (Scene preview) | pptx-convert (actual Office render)',
    )
    .option('-o, --out <dir>', 'output directory (default: <deck dir>/dist)')
    .option('--preview-width <px>', 'PNG preview width', (v) => Number.parseInt(v, 10))
    .option('--json', 'machine-readable output')
    .action(
      async (
        deck: string,
        o: {
          format?: string;
          pptxEngine?: string;
          pdfEngine?: string;
          pngEngine?: string;
          out?: string;
          previewWidth?: number;
          json?: boolean;
        },
      ) => {
        const formats = o.format
          ? (o.format.split(',').map((s) => s.trim()) as OutputKind[])
          : undefined;
        const r = await buildDeck(deck, {
          ...(formats ? { formats } : {}),
          ...(o.pptxEngine ? { pptxEngine: o.pptxEngine } : {}),
          ...(o.pdfEngine ? { pdfEngine: o.pdfEngine } : {}),
          ...(o.pngEngine ? { pngEngine: o.pngEngine } : {}),
          ...(o.out ? { outDir: o.out } : {}),
          ...(o.previewWidth ? { previewWidth: o.previewWidth } : {}),
        });
        const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
        if (wantsJson(o.json)) {
          printJson({
            ok: errors === 0,
            files: r.files,
            manifest: r.manifestPath,
            engines: r.engines,
            diagnostics: r.diagnostics,
          });
        } else {
          r.diagnostics.forEach((d) => console.log(formatDiagnostic(d)));
          console.log(`\n${summary(r.diagnostics)}`);
          const cwd = process.cwd();
          for (const [k, e] of Object.entries(r.engines))
            console.log(dim(`  ${k.padEnd(5)} ← ${e.id} (${e.reason})`));
          const pngs = r.files.filter((f) => f.kind === 'png');
          r.files
            .filter((f) => f.kind !== 'png')
            .forEach((f) => console.log(`  ${green('✔')} ${relative(cwd, f.path)}`));
          if (pngs.length)
            console.log(
              `  ${green('✔')} ${relative(cwd, join(pngs[0]!.path, '..'))}/ (${pngs.length} previews)`,
            );
          if (r.manifestPath) console.log(`  ${green('✔')} ${relative(cwd, r.manifestPath)}`);
        }
        process.exitCode = errors ? EXIT.deckErrors : EXIT.ok;
      },
    );

  program
    .command('layouts')
    .description('List layouts and their content contracts')
    .argument('[id]', 'show one layout')
    .option('--json', 'machine-readable output (full JSON Schemas)')
    .action((id: string | undefined, o: { json?: boolean }) => {
      const list = id ? LAYOUTS.filter((l) => l.id === id) : LAYOUTS;
      if (id && !list.length) {
        const hint = loadThemes().some((t) => t.id === id)
          ? ` — "${id}" is a theme; try \`slidecraft themes\``
          : loadStorylines().some((s) => s.id === id)
            ? ` — "${id}" is a storyline; try \`slidecraft storylines\``
            : '';
        console.error(`unknown layout "${id}"${hint}`);
        process.exitCode = EXIT.usage;
        return;
      }
      if (wantsJson(o.json)) printJson(list.map(layoutContract));
      else
        list.forEach((l) => {
          console.log(`${bold(l.id.padEnd(20))} ${dim(`[${l.group}]`)} ${l.purpose}`);
          console.log(dim(`${' '.repeat(21)}variants: ${l.variants.join(', ')}`));
          if (id) console.log(YAML.stringify({ example: l.examples[0] }));
        });
    });

  program
    .command('themes')
    .description('List themes')
    .option('--json', 'machine-readable output')
    .action((o: { json?: boolean }) => {
      const t = loadThemes();
      if (wantsJson(o.json)) printJson(t);
      else
        t.forEach((x) =>
          console.log(
            `${bold(x.id.padEnd(20))} ${x.description}\n${dim(`${' '.repeat(21)}best for: ${x.bestFor.join(', ')}`)}`,
          ),
        );
    });

  program
    .command('storylines')
    .description('List storylines (deck archetypes for different tasks)')
    .option('--json', 'machine-readable output')
    .action((o: { json?: boolean }) => {
      const s = loadStorylines();
      if (wantsJson(o.json)) printJson(s);
      else
        s.forEach((x) =>
          console.log(`${bold(x.id.padEnd(26))} ${x.summary}\n${dim(`${' '.repeat(27)}${x.arc}`)}`),
        );
    });

  program
    .command('schema')
    .description('Write JSON Schemas (deck, brief, theme, storyline) for editors and agents')
    .option('-o, --out <dir>', 'output directory (default: <slidecraft>/schemas)')
    .action((o: { out?: string }) => {
      const out = o.out ?? SCHEMAS_DIR;
      mkdirSync(out, { recursive: true });
      const opts = { target: 'draft-2020-12' as const, unrepresentable: 'any' as const };
      const files: Record<string, unknown> = {
        'deck.v1.json': deckJsonSchema(),
        'brief.v1.json': z.toJSONSchema(Brief, opts),
        'theme.v1.json': z.toJSONSchema(Theme, opts),
        'storyline.v1.json': z.toJSONSchema(Storyline, opts),
      };
      for (const [name, schema] of Object.entries(files)) {
        writeFileSync(join(out, name), `${JSON.stringify(schema, null, 2)}\n`);
        console.log(`${green('✔')} ${relative(process.cwd(), join(out, name))}`);
      }
    });

  program
    .command('doctor')
    .description('Show available output engines, versions and install hints')
    .option('--json', 'machine-readable output')
    .action(async (o: { json?: boolean }) => {
      const rows = [];
      for (const e of engines()) {
        const d = await detect(e);
        rows.push({
          kind: e.kind,
          id: e.id,
          label: e.label,
          license: e.license,
          proprietary: !!e.proprietary,
          capabilities: e.capabilities,
          ...d,
        });
      }
      if (wantsJson(o.json)) {
        printJson({ version: VERSION, node: process.version, engines: rows });
        return;
      }
      console.log(bold(`SlideCraft ${VERSION} · Node ${process.version}\n`));
      for (const r of rows) {
        const mark = r.available ? green('✔') : yellow('–');
        console.log(
          `${mark} ${r.kind.padEnd(5)} ${bold(r.id.padEnd(14))} ${r.label}${r.version ? dim(` v${r.version}`) : ''}`,
        );
        if (r.detail) console.log(dim(`        ${r.detail}`));
        if (!r.available && r.install) console.log(dim(`        install: ${r.install}`));
        if (r.proprietary) console.log(yellow(`        license: ${r.license}`));
      }
      console.log(dim('\nRecommendations: docs/how-to/choose-output-engine.md'));
    });

  program
    .command('new')
    .description('Scaffold a deck workspace (brief.yaml + deck.yaml) under ./slidecraft/<slug>')
    .argument('<goal-or-slug>', 'what the deck must achieve, in your words, or a kebab-case id')
    .option('--dir <dir>', 'parent directory', 'slidecraft')
    .option('--goal <text>', 'what must be true after the audience sees the deck')
    .option('--audience <text>', 'who the deck is for')
    .option('--json', 'machine-readable output')
    .action(
      (slug: string, o: { dir: string; goal?: string; audience?: string; json?: boolean }) => {
        // a sentence is the goal; the id is made from its first words
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
          const goal = slug.trim();
          slug = slugFrom(goal);
          if (!slug) {
            console.error(
              'give the deck a goal in words, e.g. "The board approves entry into Germany"',
            );
            process.exitCode = EXIT.usage;
            return;
          }
          o.goal ??= goal;
        }
        const dir = resolve(o.dir, slug);
        if (existsSync(join(dir, 'brief.yaml'))) {
          console.error(`${relative(process.cwd(), dir)}/brief.yaml already exists`);
          process.exitCode = EXIT.usage;
          return;
        }
        mkdirSync(join(dir, 'sections'), { recursive: true });
        const brief = {
          schemaVersion: 1,
          id: slug,
          goal:
            o.goal ??
            'TODO: what must be true after the audience sees this deck (decision, belief, action)',
          ask: 'TODO: the decision or action you request',
          audience: {
            who: o.audience ?? 'TODO: who reads or hears this',
            knows: 'TODO',
            cares: 'TODO',
          },
          task: 'TODO: e.g. board update, pitch, keynote',
          materials: [],
          length: { slides: 10 },
          language: 'en',
          usage: ['edit-together'],
        };
        writeFileSync(
          join(dir, 'brief.yaml'),
          `${SCHEMA_LINE('brief')}# SlideCraft brief — fill the TODOs or let your assistant ask you\n${YAML.stringify(brief)}`,
        );
        const deck = {
          schemaVersion: 1,
          id: slug,
          title: 'TODO: the answer in one sentence',
          theme: 'consulting-classic',
          status: 'ghost',
          sources: [],
          slides: [
            {
              id: 'cover',
              layout: 'title',
              title: 'TODO: the answer in one sentence',
              kicker: 'Discussion document',
            },
            {
              id: 'summary',
              layout: 'exec-summary',
              variant: 'scr',
              title: 'TODO: action title for the summary',
              ghost: { exhibit: 'SCR summary with the decision requested', confidence: 'likely' },
            },
          ],
        };
        writeFileSync(
          join(dir, 'deck.yaml'),
          `${SCHEMA_LINE('deck')}# SlideCraft deck\n${YAML.stringify(deck)}`,
        );
        if (wantsJson(o.json)) {
          printJson({
            ok: true,
            dir,
            brief: join(dir, 'brief.yaml'),
            deck: join(dir, 'deck.yaml'),
          });
          return;
        }
        console.log(
          `${green('✔')} ${relative(process.cwd(), dir)}/brief.yaml\n${green('✔')} ${relative(process.cwd(), dir)}/deck.yaml`,
        );
      },
    );
}
