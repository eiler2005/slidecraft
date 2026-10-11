import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import YAML from 'yaml';
import { convertToPdf } from '../backends/pptx-convert.ts';
import { buildGallery, buildHero, writePicker } from '../gallery.ts';
import { getLayout } from '../layouts/index.ts';
import { libraryCheck } from '../library/check.ts';
import { generateDocs } from '../library/docs.ts';
import { applyFixes, type Fix, fitTasks } from '../library/fix.ts';
import { describeJob, generateImages, openAiProvider, planImages } from '../library/images.ts';
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
import { importTheme } from '../library/theme-import.ts';
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
    .command('images')
    .description(
      'Generate pictures for slides that have an imagePrompt but no image (OpenAI-compatible API)',
    )
    .argument('<deck>', 'path to deck.yaml')
    .option('--dry-run', 'list the prompts that would be sent; send nothing')
    .option('--force', 'regenerate images that already exist')
    .option('--json', 'machine-readable output')
    .action(async (deck: string, o: { dryRun?: boolean; force?: boolean; json?: boolean }) => {
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
