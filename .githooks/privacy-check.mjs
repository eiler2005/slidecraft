#!/usr/bin/env node
// SlideCraft privacy check: keeps client material, binaries and secrets out of git.
// Modes: `index` (staged files), `tree` (all tracked files), `commit <sha>` (files touched by a commit).
// Exit 0 = clean, 1 = violations (listed on stderr), 2 = usage/git error.
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';

const PRIVATE_ROOT_DIRS = ['slidecraft', 'work', 'out'];
const PRIVATE_SEGMENTS = ['clients', 'private'];

const BINARY_EXTS = new Set([
  'pptx',
  'potx',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'zip',
  'xlsx',
  'docx',
  'key',
  'env',
  'pem',
  'p12',
]);

// Extensions that may NEVER be committed, even inside an allowlisted directory.
const NEVER_EXTS = new Set(['key', 'env', 'pem', 'p12']);

const MEDIA = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'];
// Directory prefix -> extensions allowed there (from BINARY_EXTS). '*' = any non-NEVER binary.
const ALLOWLIST = [
  { dir: 'fonts/', exts: [] }, // ttf + license texts are not in BINARY_EXTS; nothing else belongs here
  { dir: 'dist/', exts: [] }, // slidecraft.mjs + resvg.wasm are not in BINARY_EXTS either
  { dir: 'docs/gallery/', exts: MEDIA },
  { dir: 'docs/media/', exts: MEDIA },
  // the showcase deck built from examples/slidecraft-overview (npm run showcase)
  { dir: 'docs/showcase/', exts: ['pptx', 'pdf', 'png'] },
  { dir: 'tests/fixtures/', exts: '*' },
  { dir: 'tests/__snapshots__/', exts: ['png', 'pdf', 'pptx'] },
  // original artwork used by the fictional example decks
  { dir: /^examples\/[^/]+\/assets\//, exts: ['png', 'jpg', 'jpeg', 'webp'] },
];

const TEXT_EXTS = new Set(['md', 'yaml', 'yml', 'json', 'txt', 'csv', 'ts', 'mjs']);
const SKIP_CONTENT = (p) => p.startsWith('dist/') || p === 'package-lock.json';
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

const ALLOWED_EMAIL_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'anthropic.com',
  'users.noreply.github.com',
];
// Individual public addresses on other domains: the maintainer's published contact
// (LICENSE Required Notice, COMMERCIAL.md). Anyone else's address on the same domain stays blocked.
const ALLOWED_EMAILS = ['denis.ermilov@gmail.com'];
// "icon@2x.png" and friends are file names, not mailboxes.
const FILE_LIKE_TLDS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'js',
  'mjs',
  'cjs',
  'ts',
  'json',
  'css',
  'html',
  'md',
]);

const RE_PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const RE_SECRET = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i;
const RE_AWS = /AKIA[0-9A-Z]{16}/;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,}))/g;

// Some machines carry a stale single-arch git first on PATH (spawn fails with
// "Bad CPU type", errno -86); fall back to the system git in that case.
let GIT = process.env.GIT_BIN || 'git';
function git(args, opts = {}) {
  const o = {
    encoding: opts.buffer ? 'buffer' : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  try {
    return execFileSync(GIT, args, o);
  } catch (e) {
    if (GIT === 'git' && (e.errno === -86 || e.code === 'ENOENT' || e.code === 'EBADARCH')) {
      GIT = '/usr/bin/git';
      return execFileSync(GIT, args, o);
    }
    throw e;
  }
}

const splitZ = (s) => s.split('\0').filter(Boolean);

function usage() {
  console.error('usage: privacy-check index | tree | commit <sha>');
  process.exit(2);
}

function listFiles(mode, sha) {
  if (mode === 'index') {
    return {
      files: splitZ(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])),
      read: (p) => git(['cat-file', 'blob', `:${p}`], { buffer: true }),
    };
  }
  if (mode === 'tree') {
    return {
      files: splitZ(git(['ls-files', '-z'])),
      read: (p) => git(['cat-file', 'blob', `:${p}`], { buffer: true }),
    };
  }
  if (mode === 'commit' && sha) {
    return {
      files: splitZ(
        git([
          'diff-tree',
          '--root',
          '--no-commit-id',
          '-r',
          '--name-only',
          '--diff-filter=ACMR',
          '-z',
          sha,
        ]),
      ),
      read: (p) => git(['cat-file', 'blob', `${sha}:${p}`], { buffer: true }),
    };
  }
  return usage();
}

function extOf(path) {
  const base = posix.basename(path).toLowerCase();
  if (base === '.env' || base.startsWith('.env.')) return 'env';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1) : '';
}

function pathViolations(path) {
  const out = [];
  const segments = path.split('/');
  if (PRIVATE_ROOT_DIRS.includes(segments[0]) && segments.length > 1) {
    out.push(`private work directory "${segments[0]}/" must stay local`);
  }
  const hit = segments.find((s) => PRIVATE_SEGMENTS.includes(s.toLowerCase()));
  if (hit) out.push(`path segment "${hit}" is reserved for private/client material`);

  const ext = extOf(path);
  if (BINARY_EXTS.has(ext)) {
    const rule = ALLOWLIST.find((a) =>
      typeof a.dir === 'string' ? path.startsWith(a.dir) : a.dir.test(path),
    );
    const allowed = rule && !NEVER_EXTS.has(ext) && (rule.exts === '*' || rule.exts.includes(ext));
    if (!allowed) {
      out.push(
        `binary/secret-bearing file type ".${ext}" is not allowed here ` +
          `(allowed only in fonts/, dist/, docs/gallery/, docs/media/, docs/showcase/, examples/*/assets/, tests/fixtures/, tests/__snapshots__/)`,
      );
    }
  }
  return out;
}

function emailAllowed(domain, tld) {
  const d = domain.toLowerCase();
  const t = tld.toLowerCase();
  if (FILE_LIKE_TLDS.has(t) || t === 'example') return true;
  return ALLOWED_EMAIL_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`));
}

function contentViolations(path, buf) {
  const out = [];
  if (SKIP_CONTENT(path) || !TEXT_EXTS.has(extOf(path))) return out;
  if (buf.length > MAX_SCAN_BYTES || buf.includes(0)) return out;
  const lines = buf.toString('utf8').split('\n');
  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (RE_PRIVATE_KEY.test(line)) out.push(`${at}: private key block`);
    if (RE_AWS.test(line)) out.push(`${at}: AWS access key id`);
    if (RE_SECRET.test(line))
      out.push(`${at}: likely secret (api key / token / password assignment)`);
    for (const m of line.matchAll(RE_EMAIL)) {
      if (ALLOWED_EMAILS.includes(m[0].toLowerCase())) continue;
      if (!emailAllowed(m[1], m[2])) {
        out.push(`${at}: email address on a non-allowlisted domain "@${m[1]}"`);
      }
    }
  });
  return out;
}

function main() {
  const [mode, sha] = process.argv.slice(2);
  if (!mode) usage();
  let listing;
  try {
    listing = listFiles(mode, sha);
  } catch (e) {
    console.error(`privacy-check: git failed: ${String(e.stderr || e.message).trim()}`);
    process.exit(2);
  }
  const problems = [];
  for (const path of listing.files) {
    for (const reason of pathViolations(path)) problems.push({ path, reason });
    let buf;
    try {
      buf = listing.read(path);
    } catch {
      continue;
    }
    for (const reason of contentViolations(path, buf)) problems.push({ path, reason });
  }
  const label = mode === 'commit' ? `commit ${sha}` : mode;
  if (problems.length === 0) {
    console.log(`privacy-check (${label}): ${listing.files.length} file(s) clean`);
    return;
  }
  console.error(`privacy-check (${label}): BLOCKED, ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p.path}\n    -> ${p.reason}`);
  console.error(
    '\nKeep client data, binaries and secrets out of git. Fix the files above (or `git rm --cached`).',
  );
  process.exit(1);
}

main();
