/**
 * pptx-convert: turn the built PPTX into PDF with the user's own office suite, so the
 * PDF is exactly what PowerPoint (or LibreOffice) shows. Nothing is bundled.
 *  - macOS PowerPoint via AppleScript (sandboxed: first run asks once for file access)
 *  - LibreOffice headless (`soffice --convert-to pdf`)
 * SLIDECRAFT_CONVERTER=libreoffice|powerpoint forces one.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Engine } from './types.ts';

const POWERPOINT = '/Applications/Microsoft PowerPoint.app';

function which(cmd: string): string | undefined {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
  });
  const p = r.status === 0 ? r.stdout.split(/\r?\n/)[0]?.trim() : undefined;
  return p || undefined;
}

export function findSoffice(): string | undefined {
  const env = process.env.SOFFICE_PATH;
  if (env && existsSync(env)) return env;
  for (const p of [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  ]) {
    if (existsSync(p)) return p;
  }
  return which('soffice') ?? which('libreoffice');
}

function hasPowerPoint(): boolean {
  return process.platform === 'darwin' && existsSync(POWERPOINT);
}

type Converter = { kind: 'powerpoint' } | { kind: 'libreoffice'; bin: string };

function pickConverter(): Converter | undefined {
  const force = process.env.SLIDECRAFT_CONVERTER;
  const soffice = findSoffice();
  if (force === 'libreoffice') return soffice ? { kind: 'libreoffice', bin: soffice } : undefined;
  if (force === 'powerpoint') return hasPowerPoint() ? { kind: 'powerpoint' } : undefined;
  if (hasPowerPoint()) return { kind: 'powerpoint' };
  if (soffice) return { kind: 'libreoffice', bin: soffice };
  return undefined;
}

const asString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function viaPowerPoint(inPptx: string, outPdf: string): void {
  const script = `with timeout of 180 seconds
tell application "Microsoft PowerPoint"
  open (POSIX file ${asString(inPptx)})
  delay 2
  save active presentation in (POSIX file ${asString(outPdf)}) as save as PDF
  close active presentation saving no
end tell
end timeout`;
  try {
    execFileSync('osascript', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 200_000,
    });
  } catch (e) {
    const msg = String((e as { stderr?: Buffer }).stderr ?? e);
    if (msg.includes('-1712')) {
      throw new Error(
        'PowerPoint did not answer in time. On first use macOS asks you to grant PowerPoint access to the output folder — click "Grant Access" in PowerPoint and run the build again.',
      );
    }
    throw new Error(`PowerPoint export failed: ${msg.trim()}`);
  }
}

function viaLibreOffice(bin: string, inPptx: string, outDir: string): string {
  const profile = mkdtempSync(join(tmpdir(), 'sc-lo-'));
  try {
    execFileSync(
      bin,
      [
        `-env:UserInstallation=file://${profile}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        inPptx,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180_000,
      },
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  return join(outDir, basename(inPptx).replace(/\.pptx$/i, '.pdf'));
}

export const pptxConvertEngine: Engine = {
  id: 'pptx-convert',
  kind: 'pdf',
  label: 'PDF from the PPTX via PowerPoint or LibreOffice',
  license: 'uses your installed office suite',
  needsPptx: true,
  capabilities: {
    editable: false,
    nativeCharts: true,
    speakerNotes: false,
    fidelity: 'identical',
    install: 'Microsoft PowerPoint (macOS) or LibreOffice',
    ci: false,
  },
  async detect() {
    const c = pickConverter();
    if (!c) {
      return {
        available: false,
        detail: 'neither Microsoft PowerPoint (macOS) nor LibreOffice found',
        install: 'brew install --cask libreoffice  ·  or install Microsoft PowerPoint',
      };
    }
    return c.kind === 'powerpoint'
      ? {
          available: true,
          detail: 'Microsoft PowerPoint via AppleScript (first run asks once for file access)',
        }
      : { available: true, detail: `LibreOffice at ${c.bin}` };
  },
  async render(_scene, opts) {
    if (!opts.pptxPath)
      throw new Error('pptx-convert needs the PPTX built first (add pptx to formats)');
    const c = pickConverter();
    if (!c) throw new Error('No converter available — run `slidecraft doctor`');
    mkdirSync(opts.outDir, { recursive: true });
    const out = join(opts.outDir, `${opts.baseName}.pdf`);
    if (c.kind === 'powerpoint') {
      viaPowerPoint(opts.pptxPath, out);
    } else {
      const tmp = mkdtempSync(join(tmpdir(), 'sc-conv-'));
      try {
        const produced = viaLibreOffice(c.bin, opts.pptxPath, tmp);
        copyFileSync(produced, out);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }
    if (!existsSync(out)) throw new Error('Converter finished but no PDF was written');
    return {
      files: [{ path: out, kind: 'pdf', engine: 'pptx-convert' }],
      diagnostics: [],
      limitations: [
        `PDF rendered by ${c.kind === 'powerpoint' ? 'Microsoft PowerPoint' : 'LibreOffice'} from the PPTX; not byte-reproducible.`,
      ],
    };
  },
};
