import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import YAML from 'yaml';
import { buildGallery, writePicker } from '../gallery.ts';
import { getLayout } from '../layouts/index.ts';
import { libraryCheck } from '../library/check.ts';
import { generateDocs } from '../library/docs.ts';
import { getStoryline, getTheme, loadBrief, loadStorylines, loadThemes } from '../library/load.ts';
import { rankStorylines, templateOptions } from '../library/rank.ts';
import { recommendOutput } from '../library/recommend.ts';
import type { Brief } from '../spec/brief.ts';
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

/** Ghost deck from a storyline: one slide per slot, action titles to be written. */
export function scaffoldDeck(
  brief: Brief,
  storylineId: string,
  themeId: string,
): Record<string, unknown> {
  const s = getStoryline(storylineId);
  if (!s) throw new Error(`unknown storyline "${storylineId}"`);
  const slides: Record<string, unknown>[] = [];
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
              : `TODO action title — ${slot.purpose}`.slice(0, 140),
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
      }
    }
  }
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
    slides,
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
    .action((o: { brief: string; out?: string; force?: boolean }) => {
      const brief = requireBrief(o.brief);
      if (!brief.choice) throw new Error('brief has no choice yet — run `slidecraft choose` first');
      const out = resolve(o.out ?? join(dirname(resolve(o.brief)), 'deck.yaml'));
      if (existsSync(out) && !o.force)
        throw new Error(`${relative(process.cwd(), out)} exists (use --force)`);
      const deck = scaffoldDeck(brief, brief.choice.storyline, brief.choice.theme);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(
        out,
        `# SlideCraft deck — schema: schemas/deck.v1.json\n# Ghost deck: write the action titles first, review the title chain, then fill content.\n${YAML.stringify(deck, { lineWidth: 0 })}`,
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
    .action(async (o: { out?: string; themes?: string; storylines?: string }) => {
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
