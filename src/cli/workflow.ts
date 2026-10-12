import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import YAML from 'yaml';
import { convertToPdf } from '../backends/pptx-convert.ts';
import { ICON_SOURCE } from '../engine/icons.gen.ts';
import { ICON_NAMES } from '../engine/icons.ts';
import { buildGallery, buildHero, writePicker } from '../gallery.ts';
import { getLayout } from '../layouts/index.ts';
import { libraryCheck } from '../library/check.ts';
import { chooseCover, coverOptions } from '../library/covers.ts';
import { generateDocs } from '../library/docs.ts';
import { applyFixes, type Fix, fitTasks } from '../library/fix.ts';
import {
  describeJob,
  describeStock,
  fetchStock,
  generateImages,
  listStock,
  openAiProvider,
  planImages,
  planStock,
  stockProvider,
} from '../library/images.ts';
import { findInMaterials, ingest } from '../library/ingest.ts';
import {
  getStoryline,
  getTheme,
  loadBrief,
  loadStorylines,
  readThemeFile,
} from '../library/load.ts';
import { importPptx } from '../library/pptx-import.ts';
import { rankStorylines, templateOptions } from '../library/rank.ts';
import { recommendOutput } from '../library/recommend.ts';
import { syncPptx } from '../library/sync.ts';
import { importTheme } from '../library/theme-import.ts';
import { themeFromSample } from '../library/theme-sample.ts';
import { runCalibration } from '../qa/calibrate.ts';
import { buildSite } from '../site.ts';
import type { Brief } from '../spec/brief.ts';
import { SCHEMA_LINE } from './commands.ts';
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

function openFile(path: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', path] : [path];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // headless or remote session: the path is printed instead
  }
}

function requireBrief(path: string): Brief {
  const { brief, diagnostics } = loadBrief(path);
  if (!brief) {
    diagnostics.forEach((d) => console.error(formatDiagnostic(d)));
    process.exit(EXIT.deckErrors);
  }
  return brief;
}

/**
 * Trim a scaffold to the brief's slide budget: always keep the cover and the closing ask,
 * then required slots in storyline order, then optional ones. Order is preserved.
 */
function fitToLength(
  slides: Record<string, unknown>[],
  meta: { required: boolean; repeatExtra: boolean; section: number }[],
  target?: number,
): Record<string, unknown>[] {
  if (!target || slides.length <= target) return slides;
  const keep = new Set<number>([0, slides.length - 1]);
  // breadth first: one required slot from every section before a second one from any
  const seen = new Set<number>([meta[slides.length - 1]!.section]);
  const firstPerSection = meta
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => {
      if (!m.required || m.repeatExtra || keep.has(i) || seen.has(m.section)) return false;
      seen.add(m.section);
      return true;
    });
  const ranked = [
    ...firstPerSection,
    ...meta.map((m, i) => ({ m, i })).filter(({ m }) => m.required && !m.repeatExtra),
    ...meta.map((m, i) => ({ m, i })).filter(({ m }) => m.required && m.repeatExtra),
    ...meta.map((m, i) => ({ m, i })).filter(({ m }) => !m.required),
  ];
  for (const { i } of ranked) {
    if (keep.size >= target) break;
    keep.add(i);
  }
  return slides.filter((_, i) => keep.has(i));
}

/** Ghost deck from a storyline: one slide per slot, action titles to be written. */
export function scaffoldDeck(
  brief: Brief,
  storylineId: string,
  themeId: string,
): Record<string, unknown> {
  const s = getStoryline(storylineId);
  if (!s) throw new Error(`unknown storyline "${storylineId}"`);
  const slides: Record<string, unknown>[] = [];
  const meta: { required: boolean; repeatExtra: boolean; section: number }[] = [];
  for (const sec of s.sections) {
    for (const slot of sec.slots) {
      const n = slot.repeat ? Math.max(1, slot.repeat.min) : 1;
      for (let i = 0; i < n; i++) {
        const layout = getLayout(slot.layouts[0]!);
        if (!layout) continue;
        const slide: Record<string, unknown> = {
          id: n > 1 ? `${slot.id}-${i + 1}` : slot.id,
          layout: layout.id,
          title:
            slot.id === 'cover'
              ? brief.goal.slice(0, 140)
              : `TODO action title — ${slot.purpose.replace(/\.$/, '')}`.slice(0, 140),
          status: 'ghost',
          ghost: {
            exhibit: `${layout.name}: ${slot.purpose}`.slice(0, 200),
            ...(slot.inputs.length
              ? { data: `Needs: ${slot.inputs.join(', ')}`.slice(0, 200) }
              : {}),
            confidence: slot.required ? 'likely' : 'speculative',
          },
        };
        if (layout.frame === 'standard') slide.tracker = sec.name.slice(0, 40);
        if (slot.guidance)
          slide.notes = `Guidance: ${slot.guidance}${slot.layouts.length > 1 ? `\nAlternative layouts: ${slot.layouts.slice(1).join(', ')}` : ''}`;
        slides.push(slide);
        meta.push({
          required: slot.required,
          repeatExtra: i > 0,
          section: s.sections.indexOf(sec),
        });
      }
    }
  }
  const picked = fitToLength(slides, meta, brief.length?.slides);
  return {
    schemaVersion: 1,
    id: brief.id,
    title: brief.goal.slice(0, 140),
    storyline: s.id,
    theme: themeId,
    status: 'ghost',
    language: brief.language,
    ...(brief.brand?.footer ? { footer: brief.brand.footer } : {}),
    sources: [],
    ...(brief.output?.formats || brief.output?.engines ? { output: brief.output } : {}),
    slides: picked,
  };
}

export function registerWorkflowCommands(program: Command): void {
  program
    .command('templates')
    .description('Suggest templates (storyline × theme) and outputs for a brief')
    .requiredOption('-b, --brief <path>', 'brief.yaml')
    .option('--json', 'machine-readable output')
    .action(async (o: { brief: string; json?: boolean }) => {
      const brief = requireBrief(o.brief);
      const options = templateOptions(brief);
      const output = await recommendOutput(brief.usage, getTheme(options[0]!.theme));
      const ranked = rankStorylines(brief).map((r) => ({
        id: r.storyline.id,
        score: +r.score.toFixed(1),
        matched: r.matched,
      }));
      if (wantsJson(o.json)) {
        printJson({ options, output, ranked });
        return;
      }
      for (const opt of options)
        console.log(
          `${bold(opt.option)}  ${opt.storylineName} · ${opt.themeName}\n   ${dim(opt.arc)}\n   ${dim(opt.why)}`,
        );
      console.log(
        `\n${bold('Outputs')}: ${output.formats.join(', ')}  (pptx ← ${output.engines.pptx}, pdf ← ${output.engines.pdf})`,
      );
      output.rationale.forEach((r) => console.log(dim(`  · ${r}`)));
    });

  program
    .command('pick')
    .description('Render options A/B/C as contact sheets and open the picker page')
    .requiredOption('-b, --brief <path>', 'brief.yaml')
    .option('--no-open', 'do not open the page')
    .option('--json', 'machine-readable output')
    .action(async (o: { brief: string; open: boolean; json?: boolean }) => {
      const brief = requireBrief(o.brief);
      const options = templateOptions(brief);
      const out = join(dirname(resolve(o.brief)), '.slidecraft', 'picker.html');
      await writePicker(options, out, brief.goal);
      if (o.open && process.stdout.isTTY) openFile(out);
      if (wantsJson(o.json)) printJson({ picker: out, options });
      else {
        console.log(`${green('✔')} ${relative(process.cwd(), out)}`);
        options.forEach((opt) =>
          console.log(
            `  ${bold(opt.option)} ${opt.storylineName} · ${opt.themeName} → ${relative(process.cwd(), opt.preview ?? '')}`,
          ),
        );
      }
    });

  program
    .command('choose')
    .description('Record the chosen template in brief.yaml (checkpoint 2)')
    .requiredOption('-b, --brief <path>', 'brief.yaml')
    .option('--option <A|B|C>', 'one of the suggested options')
    .option('--storyline <id>')
    .option('--theme <id>')
    .action((o: { brief: string; option?: string; storyline?: string; theme?: string }) => {
      const brief = requireBrief(o.brief);
      let storyline = o.storyline;
      let theme = o.theme;
      if (o.option) {
        const opt = templateOptions(brief).find((x) => x.option === o.option!.toUpperCase());
        if (!opt) throw new Error(`no option ${o.option}`);
        storyline ??= opt.storyline;
        theme ??= opt.theme;
      }
      if (!storyline || !getStoryline(storyline))
        throw new Error(`unknown storyline "${storyline ?? ''}"`);
      if (!theme || !getTheme(theme)) throw new Error(`unknown theme "${theme ?? ''}"`);
      const doc = YAML.parseDocument(readFileSync(o.brief, 'utf8'));
      doc.set('choice', {
        storyline,
        theme,
        ...(o.option ? { option: o.option.toUpperCase() } : {}),
      });
      writeFileSync(o.brief, String(doc));
      console.log(`${green('✔')} choice: ${storyline} · ${theme}`);
    });

  program
    .command('scaffold')
    .description('Create a ghost deck.yaml from the chosen storyline (one slide per slot)')
    .requiredOption('-b, --brief <path>', 'brief.yaml')
    .option('-o, --out <path>', 'deck.yaml path (default: next to the brief)')
    .option('--force', 'overwrite an existing deck.yaml')
    .action(async (o: { brief: string; out?: string; force?: boolean }) => {
      const brief = requireBrief(o.brief);
      if (!brief.choice) throw new Error('brief has no choice yet — run `slidecraft choose` first');
      const out = resolve(o.out ?? join(dirname(resolve(o.brief)), 'deck.yaml'));
      if (existsSync(out) && !o.force)
        throw new Error(`${relative(process.cwd(), out)} exists (use --force)`);
      const deck = scaffoldDeck(brief, brief.choice.storyline, brief.choice.theme);
      if (!deck.output) {
        // carry the recommended formats/engines (e.g. html for present-live) into the deck
        const plan = await recommendOutput(brief.usage, getTheme(brief.choice.theme));
        deck.output = { formats: plan.formats, engines: plan.engines };
      }
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(
        out,
        `${SCHEMA_LINE('deck')}# Ghost deck: write the action titles first, review the title chain, then fill content.\n${YAML.stringify(deck, { lineWidth: 0 })}`,
      );
      console.log(
        `${green('✔')} ${relative(process.cwd(), out)} (${(deck.slides as unknown[]).length} ghost slides)`,
      );
    });

  program
    .command('gallery')
    .description(
      'Render contact sheets (storyline × theme) and layout thumbnails into docs/gallery',
    )
    .option('-o, --out <dir>', 'output directory')
    .option(
      '--themes <list>',
      "comma-separated theme ids (default: each storyline's recommended themes)",
    )
    .option('--storylines <list>', 'comma-separated storyline ids (default: all)')
    .option('--hero', 'also render docs/media/hero.png for the README')
    .action(async (o: { out?: string; themes?: string; storylines?: string; hero?: boolean }) => {
      const themes = o.themes ? o.themes.split(',') : undefined;
      const storylines = loadStorylines().filter(
        (s) => !o.storylines || o.storylines.split(',').includes(s.id),
      );
      const r = await buildGallery({
        ...(o.out ? { out: o.out } : {}),
        ...(themes ? { themes } : {}),
        storylines,
      });
      console.log(`${green('✔')} ${r.files.length} images`);
      if (o.hero) console.log(`${green('✔')} ${relative(process.cwd(), await buildHero())}`);
    });

  program
    .command('site')
    .description(
      'Build the static gallery site (GitHub Pages): full gallery, example decks, links to docs',
    )
    .option('-o, --out <dir>', 'output directory', 'site')
    .action(async (o: { out: string }) => {
      const r = await buildSite(o.out);
      console.log(
        `${green('✔')} ${relative(process.cwd(), r.out)}/index.html · ${r.images} images · ${r.examples} example decks`,
      );
    });

  program
    .command('gen')
    .description('Regenerate reference docs, JSON Schemas and the catalog (CI checks for drift)')
    .action(async () => {
      const files = await generateDocs();
      files.forEach((f) => console.log(`${green('✔')} ${relative(process.cwd(), f)}`));
    });

  const lib = program.command('library').description('Library maintenance');
  lib
    .command('check')
    .description('Validate storylines, themes and layouts against each other')
    .option('--json', 'machine-readable output')
    .action((o: { json?: boolean }) => {
      const d = libraryCheck();
      if (wantsJson(o.json))
        printJson({ ok: !d.some((x) => x.severity === 'error'), diagnostics: d });
      else {
        d.forEach((x) => console.log(formatDiagnostic(x)));
        console.log(summary(d));
      }
      process.exitCode = d.some((x) => x.severity === 'error') ? EXIT.deckErrors : EXIT.ok;
    });
}

export function registerBrandCommands(program: Command): void {
  const theme = program.command('theme').description('Brand themes');
  theme
    .command('import')
    .description('Create a theme from a .pptx / .potx: colours, fonts and logo')
    .argument('<file>', 'brand template (.pptx or .potx)')
    .requiredOption('--id <id>', 'kebab-case theme id, e.g. contoso')
    .option('--name <name>', 'display name')
    .option('-o, --out <dir>', 'output folder (default: ./slidecraft-theme next to the file)')
    .option(
      '--font-dir <dir>',
      'folder with the brand font files (TTF/OTF) to measure them exactly',
    )
    .option('--json', 'machine-readable output')
    .action(
      async (
        file: string,
        o: { id: string; name?: string; out?: string; fontDir?: string; json?: boolean },
      ) => {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(o.id)) throw new Error('--id must be kebab-case');
        const r = await importTheme(file, {
          id: o.id,
          ...(o.name ? { name: o.name } : {}),
          ...(o.out ? { out: o.out } : {}),
          ...(o.fontDir ? { fontDir: o.fontDir } : {}),
        });
        if (wantsJson(o.json)) {
          printJson(r);
          return;
        }
        console.log(
          `${green('✔')} ${relative(process.cwd(), r.themePath)}${r.logo ? `\n${green('✔')} ${relative(process.cwd(), r.logo)}` : ''}`,
        );
        r.notes.forEach((n) => console.log(dim(`  · ${n}`)));
        console.log(
          dim(
            `\nUse it: theme: ${relative(process.cwd(), r.themePath)}   (path relative to deck.yaml)`,
          ),
        );
      },
    );

  theme
    .command('from')
    .description(
      'Create a theme from a sample: a reference PDF, a screenshot (PNG/JPEG) or a website — colours, fonts and margins',
    )
    .argument('<sample>', 'PDF, PNG/JPEG file or http(s) URL')
    .requiredOption('--id <id>', 'theme id (kebab-case)')
    .option('--name <name>', 'display name')
    .option('-o, --out <dir>', 'output folder', 'slidecraft-theme')
    .option('--font-dir <dir>', 'folder with the font files (TTF/OTF) to measure them exactly')
    .option('--heading-font <name>', 'heading font, when the sample has none (pictures)')
    .option('--body-font <name>', 'body font, when the sample has none (pictures)')
    .option('--json', 'machine-readable output')
    .action(
      async (
        sample: string,
        o: {
          id: string;
          name?: string;
          out: string;
          fontDir?: string;
          headingFont?: string;
          bodyFont?: string;
          json?: boolean;
        },
      ) => {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(o.id)) throw new Error('--id must be kebab-case');
        const r = await themeFromSample(sample, {
          id: o.id,
          out: o.out,
          ...(o.name ? { name: o.name } : {}),
          ...(o.fontDir ? { fontDir: o.fontDir } : {}),
          ...(o.headingFont ? { headingFont: o.headingFont } : {}),
          ...(o.bodyFont ? { bodyFont: o.bodyFont } : {}),
        });
        if (wantsJson(o.json)) {
          printJson(r);
          return;
        }
        const c = r.theme.colors;
        console.log(`${green('✔')} ${relative(process.cwd(), r.themePath)}`);
        if (r.formatPath) console.log(`${green('✔')} ${relative(process.cwd(), r.formatPath)}`);
        console.log(
          dim(
            `  background ${c.background} · ink ${c.ink} · accent ${c.accent} · fonts ${r.theme.fonts.heading.family} / ${r.theme.fonts.body.family}`,
          ),
        );
        r.notes.forEach((n) => console.log(dim(`  · ${n}`)));
        console.log(
          dim(
            `\nUse it: theme: ${relative(process.cwd(), r.themePath)}   (path relative to deck.yaml)`,
          ),
        );
      },
    );

  program
    .command('import')
    .description(
      'Import an existing .pptx into a draft deck.yaml (text, tables, charts, images, notes)',
    )
    .argument('<file>', 'the presentation to import')
    .option('-o, --out <dir>', 'output folder (default: ./slidecraft/<file-name>)')
    .option('--id <id>', 'deck id')
    .option('--theme <id|path>', 'theme for the draft', 'consulting-classic')
    .option(
      '--render',
      'also render the original to original.pdf (PowerPoint/LibreOffice) for a visual redesign pass',
    )
    .option('--json', 'machine-readable output')
    .action(
      async (
        file: string,
        o: { out?: string; id?: string; theme: string; render?: boolean; json?: boolean },
      ) => {
        const r = await importPptx(file, {
          ...(o.out ? { out: o.out } : {}),
          ...(o.id ? { id: o.id } : {}),
          theme: o.theme,
        });
        if (o.render) {
          const pdf = join(dirname(r.deckPath), 'original.pdf');
          convertToPdf(file, pdf);
          (r as typeof r & { original?: string }).original = pdf;
        }
        if (wantsJson(o.json)) {
          printJson(r);
          return;
        }
        console.log(
          `${green('✔')} ${relative(process.cwd(), r.deckPath)} · ${r.slides} slides · ${Object.entries(
            r.layouts,
          )
            .map(([k, v]) => `${k} ×${v}`)
            .join(', ')}`,
        );
        if (r.shortened)
          console.log(
            dim(`  ${r.shortened} text field(s) shortened to fit; originals are in speaker notes`),
          );
        console.log(
          dim(
            '  Next: slidecraft check, then restyle — rewrite titles as claims, swap text slides for exhibits.',
          ),
        );
      },
    );

  program
    .command('ingest')
    .description(
      'Add client material (PDF, DOCX, PPTX, XLSX, CSV, MD) as sources with page-level references',
    )
    .argument('<files...>', 'documents to read')
    .requiredOption('--deck <deck>', 'deck.yaml that gets the sources')
    .option('--dir <dir>', 'where the extracted text goes (default: materials/ next to the deck)')
    .option('--json', 'machine-readable output')
    .action(async (files: string[], o: { deck: string; dir?: string; json?: boolean }) => {
      const r = await ingest(files, { deck: o.deck, ...(o.dir ? { dir: o.dir } : {}) });
      if (wantsJson(o.json)) printJson({ ok: true, sources: r });
      else
        r.forEach((x) =>
          console.log(
            `${green('✔')} ${x.id} · ${x.kind} · ${x.sections} ${x.kind === 'pdf' ? 'pages' : 'parts'} → ${relative(process.cwd(), x.materials)}${x.added ? '' : dim(' (source already in the deck)')}`,
          ),
        );
    });

  program
    .command('find')
    .description('Find a phrase in ingested material; each hit comes with the citation to use')
    .argument('<query>', 'words to look for')
    .option('--deck <deck>', 'deck.yaml whose materials/ to search', 'deck.yaml')
    .option('--dir <dir>', 'materials directory (overrides --deck)')
    .option('--json', 'machine-readable output')
    .action((query: string, o: { deck: string; dir?: string; json?: boolean }) => {
      const dir = resolve(o.dir ?? join(dirname(resolve(o.deck)), 'materials'));
      const hits = findInMaterials(query, dir);
      if (wantsJson(o.json)) printJson({ hits });
      else if (!hits.length) console.log('No matches.');
      else hits.forEach((h) => console.log(`${h.ref}  ${dim(h.where)}\n    ${h.snippet}`));
    });

  program
    .command('fix')
    .description(
      'Fit-fix loop: list texts that do not fit with an exact character budget, or apply rewrites by JSON pointer',
    )
    .argument('<deck>', 'path to deck.yaml')
    .option(
      '--apply <fixes.json>',
      'JSON list of { pointer, text } rewrites to write into the YAML',
    )
    .option('--json', 'machine-readable output')
    .action((deck: string, o: { apply?: string; json?: boolean }) => {
      if (o.apply) {
        const fixes = JSON.parse(readFileSync(o.apply, 'utf8')) as Fix[];
        const r = applyFixes(deck, fixes);
        if (wantsJson(o.json)) printJson(r);
        else {
          console.log(`${green('✔')} applied ${r.applied} rewrite(s)`);
          r.errors.forEach((e) => console.log(`✗ ${e}`));
          r.remaining.forEach((t) =>
            console.log(
              `  still long: ${t.pointer} (${t.length}${t.budget ? ` → ≤ ${t.budget}` : ''})`,
            ),
          );
        }
        process.exitCode = r.errors.length || r.remaining.length ? 1 : 0;
        return;
      }
      const tasks = fitTasks(deck);
      if (wantsJson(o.json)) printJson({ ok: tasks.length === 0, tasks });
      else if (!tasks.length) console.log(`${green('✔')} everything fits`);
      else
        tasks.forEach((t) =>
          console.log(
            `${t.slide ?? ''} ${t.pointer}  ${t.length} chars${t.budget ? ` → rewrite to ≤ ${t.budget}` : ''}\n    "${t.text.slice(0, 100)}${t.text.length > 100 ? '…' : ''}"`,
          ),
        );
      process.exitCode = tasks.length ? 1 : 0;
    });

  program
    .command('sync')
    .description(
      'Bring text edited in PowerPoint (or Keynote, Google Slides) back into deck.yaml, field by field',
    )
    .argument('<deck>', 'path to deck.yaml')
    .argument('<pptx>', 'the edited .pptx (built by SlideCraft, then edited)')
    .option('--apply', 'write the changes into the YAML (comments kept) and re-check')
    .option('--json', 'machine-readable output')
    .action((deck: string, pptx: string, o: { apply?: boolean; json?: boolean }) => {
      const r = syncPptx(deck, pptx, { ...(o.apply ? { apply: true } : {}) });
      if (wantsJson(o.json)) return printJson(r);
      const show = (v: string | string[]) => (Array.isArray(v) ? v.join(' | ') : v);
      if (!r.changes.length) console.log(`${green('✔')} no text changes to bring back`);
      for (const c of r.changes)
        console.log(
          `${c.slide} ${c.pointer.replace(/^\/slides\/\d+\//, '')}\n  - ${show(c.before)}\n  + ${show(c.after)}`,
        );
      for (const s of r.skipped)
        console.log(
          `${yellow('!')} ${s.slide} ${s.pointer ?? ''}: ${s.reason}${s.text ? `\n    "${s.text.slice(0, 100)}"` : ''}`,
        );
      for (const n of r.notes) console.log(dim(`· ${n}`));
      if (o.apply) {
        console.log(`${green('✔')} wrote ${r.applied ?? 0} field(s) into the YAML`);
        for (const t of r.remaining ?? [])
          console.log(
            `  now too long: ${t.pointer} (${t.length}${t.budget ? ` → ≤ ${t.budget}` : ''}) — slidecraft fix`,
          );
      } else if (r.changes.length)
        console.log(dim('\nRun again with --apply to write these changes.'));
    });

  program
    .command('images')
    .description(
      'Fill empty image slots: generate pictures for imagePrompt (OpenAI-compatible API), or find licensed stock photos for imageQuery (--stock)',
    )
    .argument('<deck>', 'path to deck.yaml')
    .option('--dry-run', 'list the prompts or searches that would be sent; send nothing')
    .option('--force', 'replace images that already exist')
    .option(
      '--stock [provider]',
      'stock photos for imageQuery: openverse (default, no key), pexels (PEXELS_API_KEY), pixabay (PIXABAY_API_KEY)',
    )
    .option(
      '--list',
      'with --stock: show candidate photos (title, author, licence, link); download nothing',
    )
    .option('--pick <n>', 'with --stock: take the n-th candidate from --list', (v) => Number(v), 1)
    .option('--json', 'machine-readable output')
    .action(
      async (
        deck: string,
        o: {
          dryRun?: boolean;
          force?: boolean;
          json?: boolean;
          stock?: string | boolean;
          list?: boolean;
          pick: number;
        },
      ) => {
        if (o.stock) {
          const jobs = planStock(deck, { force: !!o.force });
          if (o.dryRun || !jobs.length) {
            if (wantsJson(o.json)) printJson({ jobs });
            else if (!jobs.length) console.log('No empty image slots with an imageQuery.');
            else jobs.forEach((j) => console.log(`  ${describeStock(j)}`));
            return;
          }
          const provider = stockProvider(typeof o.stock === 'string' ? o.stock : 'openverse');
          if (o.list) {
            const lists = await listStock(jobs, provider);
            if (wantsJson(o.json)) printJson({ candidates: lists });
            else
              for (const l of lists) {
                console.log(`${l.slideId} — "${l.query}"`);
                l.hits.forEach((h, i) =>
                  console.log(
                    `  ${i + 1}. ${h.credit.title ?? '(untitled)'} — ${h.credit.author}, ${h.credit.license} · ${h.width}×${h.height}\n     ${h.url}`,
                  ),
                );
              }
            return;
          }
          if (!wantsJson(o.json))
            console.log(dim(`Searching ${provider.id} for ${jobs.length} photo(s) …`));
          const r = await fetchStock(jobs, provider, fetch, o.pick);
          if (wantsJson(o.json)) printJson(r);
          else {
            r.found.forEach((j) =>
              console.log(
                `${green('✔')} ${describeStock(j)}\n    ${j.credit.author} / ${j.credit.provider}, ${j.credit.license}`,
              ),
            );
            r.failed.forEach((f) => console.log(`✗ ${f.job.slideId}: ${f.error}`));
          }
          process.exitCode = r.failed.length ? 1 : 0;
          return;
        }
        const jobs = planImages(deck, { force: !!o.force });
        if (o.dryRun || !jobs.length) {
          if (wantsJson(o.json)) printJson({ jobs });
          else if (!jobs.length) console.log('No empty image slots with an imagePrompt.');
          else jobs.forEach((j) => console.log(`  ${describeJob(j)}`));
          return;
        }
        const provider = openAiProvider();
        if (!wantsJson(o.json))
          console.log(dim(`Sending ${jobs.length} prompt(s) to ${provider.id} …`));
        const r = await generateImages(jobs, provider);
        if (wantsJson(o.json)) printJson(r);
        else {
          r.generated.forEach((j) => console.log(`${green('✔')} ${describeJob(j)}`));
          r.failed.forEach((f) => console.log(`✗ ${f.job.slideId}: ${f.error}`));
        }
        process.exitCode = r.failed.length ? 1 : 0;
      },
    );

  program
    .command('covers')
    .description(
      'Render 2–3 cover options (topic motifs, a photo) with facts to compare; --choose writes the chosen one into deck.yaml',
    )
    .argument('<deck>', 'path to deck.yaml')
    .option(
      '--stock [provider]',
      'include a stock photo for the cover imageQuery: openverse (default), pexels, pixabay',
    )
    .option('--choose <letter>', 'write option A, B or C into the cover slide')
    .option('--json', 'machine-readable output')
    .action(
      async (deck: string, o: { stock?: string | boolean; choose?: string; json?: boolean }) => {
        if (o.choose) {
          const c = chooseCover(deck, o.choose);
          if (wantsJson(o.json)) printJson({ chosen: c });
          else console.log(`${green('✔')} cover option ${c.option}: ${c.label} → deck.yaml`);
          return;
        }
        const r = await coverOptions(deck, {
          ...(o.stock
            ? { provider: stockProvider(typeof o.stock === 'string' ? o.stock : 'openverse') }
            : {}),
        });
        if (wantsJson(o.json)) {
          printJson(r);
          return;
        }
        console.log(`Cover options for "${r.message.title}"`);
        for (const x of r.options) {
          const f = x.facts;
          console.log(`  ${x.option}. ${x.label}`);
          if (f.topicWords?.length) console.log(dim(`     stands for: ${f.topicWords.join(', ')}`));
          if (f.credit)
            console.log(dim(`     ${f.credit.author} / ${f.credit.provider}, ${f.credit.license}`));
          if (f.ppi)
            console.log(
              dim(`     ${f.ppi} ppi on the panel${f.ppi < 144 ? ' — soft when projected' : ''}`),
            );
          console.log(dim(`     ${relative(process.cwd(), x.preview)}`));
        }
        console.log(dim(`\nOpen ${relative(process.cwd(), r.picker)}; then --choose A|B|C`));
      },
    );

  program
    .command('icons')
    .description('List the bundled icons for `icon:` fields (Tabler Icons, MIT)')
    .option('--json', 'machine-readable output')
    .action((o: { json?: boolean }) => {
      if (wantsJson(o.json)) printJson({ source: ICON_SOURCE, icons: ICON_NAMES });
      else {
        console.log(dim(`${ICON_NAMES.length} icons · ${ICON_SOURCE}`));
        console.log(ICON_NAMES.join('  '));
      }
    });

  program
    .command('calibrate')
    .description(
      "Check that line breaks match PowerPoint for a theme's fonts (needs PowerPoint or LibreOffice + poppler)",
    )
    .option('--theme <id|path>', 'theme id or theme JSON path', 'consulting-classic')
    .option('-o, --out <dir>', 'output folder', 'slidecraft/calibration')
    .option('--json', 'machine-readable output')
    .action(async (o: { theme: string; out: string; json?: boolean }) => {
      const t = /\.json$/i.test(o.theme) ? readThemeFile(o.theme) : getTheme(o.theme);
      if (!t) throw new Error(`unknown theme "${o.theme}"`);
      const fonts = [
        t.fonts.heading,
        t.fonts.body,
        ...(t.fonts.cyrillic?.heading ? [t.fonts.cyrillic.heading] : []),
      ];
      const r = await runCalibration(fonts, resolve(o.out));
      if (wantsJson(o.json)) {
        printJson(r);
        return;
      }
      if (r.skipped) {
        console.log(
          `calibration PPTX written to ${relative(process.cwd(), r.pptx)}; comparison skipped: ${r.skipped}`,
        );
        return;
      }
      r.mismatches.forEach((m) => console.log(dim(`  ${m}`)));
      console.log(
        `\n${r.total} strings · identical ${r.same} (${((r.same / r.total) * 100).toFixed(1)}%) · PowerPoint needs more lines ${r.more} · fewer ${r.fewer}`,
      );
      console.log(
        r.go
          ? green('GO — measurement matches PowerPoint for this theme')
          : 'NO-GO — increase spacing or provide the exact font files',
      );
      process.exitCode = r.go ? 0 : 1;
    });
}
