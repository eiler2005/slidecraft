import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HOOKS_SRC = resolve(import.meta.dirname, '..', '.githooks');

// Env without inherited GIT_* so the temp repo never talks to the outer one.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
) as NodeJS.ProcessEnv;

let repo: string;

function run(cmd: string, args: string[], input?: string) {
  let r = spawnSync(cmd, args, { cwd: repo, env: cleanEnv, encoding: 'utf8', input });
  // Fall back to the system git when a stale single-arch git is first on PATH.
  if (r.error && cmd === 'git')
    r = spawnSync('/usr/bin/git', args, { cwd: repo, env: cleanEnv, encoding: 'utf8', input });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const git = (...args: string[]) => run('git', args);

function write(path: string, content: string | Buffer) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
function stage(path: string, content: string | Buffer = 'hello\n') {
  write(path, content);
  expect(git('add', '-f', path).code).toBe(0);
}
const check = (...args: string[]) => run('.githooks/privacy-check', args);

// Test inputs are assembled at runtime so this file itself passes the privacy scan.
const foreignEmail = `jane.doe@${'corp'}-mail.io`;
const allowedEmail = `jane.doe@${'example'}.com`;
const fakeSecret = `api_key: ${'abcd1234'.repeat(3)}`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'sc-privacy-'));
  git('init', '-q');
  git('config', 'user.email', `t@${'example'}.com`);
  git('config', 'user.name', 'Test');
  mkdirSync(join(repo, '.githooks'));
  for (const f of ['privacy-check', 'privacy-check.mjs', 'pre-push']) {
    copyFileSync(join(HOOKS_SRC, f), join(repo, '.githooks', f));
    run('chmod', ['+x', `.githooks/${f}`]);
  }
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('privacy-check index', () => {
  it('passes clean staged files', () => {
    stage('src/a.ts', 'export const a = 1;\n');
    stage('docs/readme.md', `Contact ${allowedEmail}\n`);
    const r = check('index');
    expect(r.code).toBe(0);
  });

  it('blocks a binary outside the allowlist', () => {
    stage('notes/photo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('notes/photo.png');
    expect(r.out).toContain('.png');
  });

  it('blocks a pptx under slidecraft/', () => {
    stage('slidecraft/deck.pptx', Buffer.from('PK'));
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('slidecraft/deck.pptx');
    expect(r.out).toContain('private work directory');
  });

  it('blocks clients/ and private/ path segments', () => {
    stage('docs/clients/acme.md', 'x\n');
    stage('src/private/x.ts', 'x\n');
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docs/clients/acme.md');
    expect(r.out).toContain('src/private/x.ts');
  });

  it('blocks a secret in yaml', () => {
    stage('config/app.yaml', `${fakeSecret}\n`);
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('config/app.yaml');
    expect(r.out).toContain('likely secret');
    expect(r.out).not.toContain('abcd1234');
  });

  it('blocks private keys and AWS keys', () => {
    stage('keys.txt', `-----BEGIN ${'RSA'} PRIVATE KEY-----\n`);
    stage('aws.json', `{"id": "${'AKIA'}${'ABCDEFGHIJKLMNOP'}"}\n`);
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('private key block');
    expect(r.out).toContain('AWS access key');
  });

  it('blocks a foreign email address', () => {
    stage('docs/contact.md', `Write to ${foreignEmail}\n`);
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docs/contact.md');
    expect(r.out).toContain('email');
  });

  it('allows example.com, *.example and anthropic.com emails', () => {
    stage(
      'docs/contact.md',
      `${allowedEmail}\nbob@${'mail'}.example\nnoreply@${'anthropic'}.com\n`,
    );
    expect(check('index').code).toBe(0);
  });

  it('allows ttf in fonts/ and wasm in dist/', () => {
    stage('fonts/x/Font-Regular.ttf', Buffer.from([0, 1, 2, 3]));
    stage('fonts/x/OFL.txt', 'SIL Open Font License\n');
    stage('dist/resvg.wasm', Buffer.from([0, 0x61, 0x73, 0x6d]));
    expect(check('index').code).toBe(0);
  });

  it('allows images in docs/gallery and fixtures but never pem/env', () => {
    stage('docs/gallery/a.png', Buffer.from([1, 2, 3]));
    stage('tests/fixtures/a.pptx', Buffer.from('PK'));
    expect(check('index').code).toBe(0);
    stage('tests/fixtures/secret.pem', 'x');
    const r = check('index');
    expect(r.code).toBe(1);
    expect(r.out).toContain('tests/fixtures/secret.pem');
  });

  it('blocks .env files', () => {
    stage('.env', 'A=1\n');
    expect(check('index').code).toBe(1);
  });

  it('ignores unstaged offenders', () => {
    stage('src/a.ts', 'ok\n');
    write('out/deck.pptx', 'PK');
    expect(check('index').code).toBe(0);
  });
});

describe('privacy-check tree / commit', () => {
  it('tree scans all tracked files', () => {
    stage('src/a.ts', 'ok\n');
    git('commit', '-q', '-m', 'init');
    expect(check('tree').code).toBe(0);
    stage('bad/file.zip', 'PK');
    git('commit', '-q', '-m', 'bad');
    const r = check('tree');
    expect(r.code).toBe(1);
    expect(r.out).toContain('bad/file.zip');
  });

  it('commit <sha> scans only that commit', () => {
    stage('bad/file.zip', 'PK');
    git('commit', '-q', '-m', 'bad');
    const bad = git('rev-parse', 'HEAD').out.trim();
    stage('src/a.ts', 'ok\n');
    git('commit', '-q', '-m', 'good');
    const good = git('rev-parse', 'HEAD').out.trim();
    expect(check('commit', good).code).toBe(0);
    expect(check('commit', bad).code).toBe(1);
  });

  it('exits 2 on bad usage', () => {
    expect(check().code).toBe(2);
    expect(check('commit').code).toBe(2);
  });
});

describe('pre-push', () => {
  const ZERO = '0'.repeat(40);

  it('refuses refs/heads/local/*', () => {
    stage('src/a.ts', 'ok\n');
    git('commit', '-q', '-m', 'init');
    const sha = git('rev-parse', 'HEAD').out.trim();
    const r = run(
      '.githooks/pre-push',
      ['origin', 'url'],
      `refs/heads/local/x ${sha} refs/heads/local/x ${ZERO}\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain('local/*');
  });

  it('blocks a push containing a bad commit, passes a clean one', () => {
    stage('src/a.ts', 'ok\n');
    git('commit', '-q', '-m', 'init');
    const sha = git('rev-parse', 'HEAD').out.trim();
    const line = `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`;
    expect(run('.githooks/pre-push', ['origin', 'url'], line).code).toBe(0);

    stage('work/notes.md', 'x\n');
    git('commit', '-q', '-m', 'bad');
    const bad = git('rev-parse', 'HEAD').out.trim();
    const r = run(
      '.githooks/pre-push',
      ['origin', 'url'],
      `refs/heads/main ${bad} refs/heads/main ${sha}\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain('work/notes.md');
  });
});
