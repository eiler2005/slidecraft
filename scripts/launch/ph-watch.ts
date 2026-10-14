/**
 * Product Hunt launch-day watcher: votes, comments and daily rank of our post, plus the gap to #5.
 * Also a research mode that lists the top 5 featured posts of earlier days.
 * Uses the Product Hunt API v2 (GraphQL) with the global fetch only; nothing here ships to npm.
 *
 *   npx tsx scripts/launch/ph-watch.ts --slug <post-slug> [--interval 10] [--once] [--verbose]
 *   npx tsx scripts/launch/ph-watch.ts --days 2026-10-11,2026-10-04
 *
 * Reads the developer token from the PRODUCTHUNT_DEVELOPER_TOKEN environment variable, else from
 * .env.launch at the repo root (template: scripts/launch/launch.env.example).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(import.meta.dirname, '..', '..');
const ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const TOKEN_VAR = 'PRODUCTHUNT_DEVELOPER_TOKEN';
const PT = 'America/Los_Angeles';
const MSK = 'Europe/Moscow';

const USAGE = `Product Hunt launch watcher

Usage:
  npx tsx scripts/launch/ph-watch.ts --slug <post-slug> [--interval 10] [--once] [--verbose]
  npx tsx scripts/launch/ph-watch.ts --days 2026-10-11,2026-10-04 [--verbose]

Options:
  --slug <slug>     Our post (the part after /posts/ in its Product Hunt URL, or the URL itself).
                    Shows time (MSK and PT), votes, comments, rank among today's featured posts,
                    the votes of #1 and #5 and the gap to #5. "Today" is the current Pacific day.
  --interval <min>  Minutes between checks (default 10, minimum 1). Ignored with --once.
  --once            Check once and exit.
  --days <dates>    Research mode: comma-separated Pacific dates (YYYY-MM-DD). For each date,
                    prints the number of featured posts and the top 5 (votes, comments, name,
                    tagline). Runs once.
  --verbose         Print the X-Rate-Limit-Remaining header after each request.
  -h, --help        This text.

Token: ${TOKEN_VAR} in the environment, else the line ${TOKEN_VAR}=…
in .env.launch at the repo root (git-ignored). Create one at
https://www.producthunt.com/v2/oauth/applications. The token is never printed.`;

// ---------- token ----------

/** Reads KEY=VALUE lines: comments, an `export` prefix and surrounding quotes are ignored. */
function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = (m[2] ?? '').trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.lastIndexOf(quote) > 0) {
      value = value.slice(1, value.lastIndexOf(quote));
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    out[m[1]!] = value;
  }
  return out;
}

function loadToken(): string | undefined {
  const fromEnv = process.env[TOKEN_VAR]?.trim();
  if (fromEnv) return fromEnv;
  const file = join(ROOT, '.env.launch');
  if (!existsSync(file)) return undefined;
  return parseEnvFile(readFileSync(file, 'utf8'))[TOKEN_VAR] || undefined;
}

// ---------- Pacific and Moscow time ----------

/** Offset of `tz` from UTC at `instant`, in ms (positive east of Greenwich). */
function zoneOffsetMs(instant: number, tz: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(whole));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - whole;
}

/** The UTC instant at which the calendar date `ymd` (YYYY-MM-DD) starts in `tz`. DST-safe. */
function zonedMidnightUtc(ymd: string, tz: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d);
  // Two passes: the first offset may belong to the other side of a DST change.
  const first = wall - zoneOffsetMs(wall, tz);
  return new Date(wall - zoneOffsetMs(first, tz));
}

/** YYYY-MM-DD of `instant` in `tz`. */
function zonedDate(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')}`;
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return new Date(`${ymd}T00:00:00Z`).toISOString().slice(0, 10) === ymd;
}

/** "Sun 18 Oct 10:31 MSK" / "Sun 18 Oct 00:31 PT". */
function clock(instant: Date, tz: string, label: string): string {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(instant)
    .replace(',', '');
  return `${s} ${label}`;
}

// ---------- API ----------

interface PhPost {
  id: string;
  name: string;
  tagline: string;
  slug: string;
  votesCount: number;
  commentsCount: number;
}

interface PostList {
  totalCount: number | null;
  edges: { node: PhPost }[];
}

interface GraphQlResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

class ApiError extends Error {}
/** The token was refused: stop instead of retrying in the loop. */
class AuthError extends ApiError {}

const POST_FIELDS = 'id name tagline slug votesCount commentsCount';

const WATCH_QUERY = `query Watch($slug: String!, $after: DateTime!, $first: Int!) {
  post(slug: $slug) { ${POST_FIELDS} }
  posts(postedAfter: $after, order: RANKING, first: $first, featured: true) {
    totalCount
    edges { node { ${POST_FIELDS} } }
  }
}`;

const DAY_QUERY = `query Day($after: DateTime!, $before: DateTime!, $first: Int!) {
  posts(postedAfter: $after, postedBefore: $before, order: RANKING, first: $first, featured: true) {
    totalCount
    edges { node { ${POST_FIELDS} } }
  }
}`;

interface Client {
  query<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

function makeClient(token: string, verbose: boolean): Client {
  const redact = (s: string) => s.split(token).join('***');
  return {
    async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch (e) {
        throw new ApiError(`Network error: ${redact(e instanceof Error ? e.message : String(e))}`);
      }
      if (verbose) {
        const left = res.headers.get('x-rate-limit-remaining');
        const limit = res.headers.get('x-rate-limit-limit');
        const reset = res.headers.get('x-rate-limit-reset');
        console.log(
          `  [rate limit] remaining ${left ?? 'n/a'}${limit ? ` of ${limit}` : ''}${reset ? `, resets in ${reset}s` : ''}`,
        );
      }
      if (res.status === 401) {
        throw new AuthError(
          `Product Hunt API rejected the token (401). Create a developer token at https://www.producthunt.com/v2/oauth/applications and put it in .env.launch as ${TOKEN_VAR}=…`,
        );
      }
      if (res.status === 429) {
        const reset = res.headers.get('x-rate-limit-reset');
        throw new ApiError(
          `Product Hunt API rate limit reached (429).${reset ? ` Resets in ${reset}s.` : ''} Raise --interval.`,
        );
      }
      const text = await res.text();
      let body: GraphQlResponse<T>;
      try {
        body = JSON.parse(text) as GraphQlResponse<T>;
      } catch {
        throw new ApiError(
          `HTTP ${res.status}: unexpected response (${redact(text.slice(0, 120))})`,
        );
      }
      if (body.errors?.length && !body.data) {
        throw new ApiError(
          `HTTP ${res.status}: ${redact(body.errors.map((e) => e.message).join('; '))}`,
        );
      }
      if (!res.ok || !body.data) throw new ApiError(`HTTP ${res.status}`);
      if (body.errors?.length) {
        console.warn(`  [warning] ${redact(body.errors.map((e) => e.message).join('; '))}`);
      }
      return body.data;
    },
  };
}

// ---------- output ----------

const short = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Accepts a bare slug or a full Product Hunt URL. */
function normaliseSlug(input: string): string {
  const trimmed = input
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

async function watchOnce(client: Client, slug: string): Promise<void> {
  const now = new Date();
  const day = zonedDate(now, PT);
  const after = zonedMidnightUtc(day, PT);
  const data = await client.query<{ post: PhPost | null; posts: PostList }>(WATCH_QUERY, {
    slug,
    after: after.toISOString(),
    first: 30,
  });

  console.log(`\n${clock(now, MSK, 'MSK')}  |  ${clock(now, PT, 'PT')}`);
  const list = data.posts.edges.map((e) => e.node);
  const me = data.post;
  if (me) {
    console.log(`  ${me.name}: ${short(me.tagline, 60)}`);
    console.log(`  votes ${me.votesCount} · comments ${me.commentsCount}`);
  } else {
    console.log(`  Post "${slug}" not found (not public yet, or the slug is wrong).`);
  }

  const featured = data.posts.totalCount ?? list.length;
  const idx = me ? list.findIndex((p) => p.id === me.id || p.slug === me.slug) : -1;
  if (me) {
    console.log(
      idx >= 0
        ? `  rank #${idx + 1} of ${featured} featured on ${day} (PT)`
        : `  not in the top ${list.length} of ${featured} featured on ${day} (PT), or not featured yet`,
    );
  } else {
    console.log(`  ${featured} featured on ${day} (PT) so far`);
  }

  const first = list[0];
  const fifth = list[4];
  if (first) console.log(`  #1  ${first.votesCount} votes · ${first.name}`);
  if (fifth) {
    console.log(`  #5  ${fifth.votesCount} votes · ${fifth.name}`);
    if (me) {
      const diff = me.votesCount - fifth.votesCount;
      console.log(
        idx === 4
          ? '  gap to #5: you are #5'
          : diff > 0
            ? `  gap to #5: ${plural(diff, 'vote')} ahead`
            : diff === 0
              ? '  gap to #5: level with #5'
              : `  gap to #5: ${plural(-diff, 'vote')} behind`,
      );
    }
  } else if (list.length > 0) {
    console.log(`  only ${list.length} featured so far, no #5 yet`);
  }
}

async function researchDays(client: Client, days: string[]): Promise<void> {
  for (const day of days) {
    const data = await client.query<{ posts: PostList }>(DAY_QUERY, {
      after: zonedMidnightUtc(day, PT).toISOString(),
      before: zonedMidnightUtc(addDays(day, 1), PT).toISOString(),
      first: 5,
    });
    const top = data.posts.edges.map((e) => e.node);
    console.log(`\n${day} (PT): ${data.posts.totalCount ?? top.length} featured`);
    top.forEach((p, i) => {
      console.log(
        `  #${i + 1}  ${String(p.votesCount).padStart(5)} votes  ${String(p.commentsCount).padStart(4)} comments  ${p.name} — ${short(p.tagline, 60)}`,
      );
    });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<number> {
  let values: {
    slug?: string;
    interval?: string;
    once?: boolean;
    days?: string;
    verbose?: boolean;
    help?: boolean;
  };
  try {
    values = parseArgs({
      options: {
        slug: { type: 'string' },
        interval: { type: 'string' },
        once: { type: 'boolean' },
        days: { type: 'string' },
        verbose: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    }).values;
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
    return 2;
  }
  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const days = values.days
    ? values.days
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    : [];
  const bad = days.find((d) => !isRealDate(d));
  if (bad) {
    console.error(`Not a date (expected YYYY-MM-DD): ${bad}`);
    return 2;
  }
  const slug = values.slug ? normaliseSlug(values.slug) : '';
  if (!days.length && !slug) {
    console.error(`Pass --slug <post-slug> or --days <dates>.\n\n${USAGE}`);
    return 2;
  }
  const interval = values.interval === undefined ? 10 : Number(values.interval);
  if (!Number.isFinite(interval) || interval < 1) {
    console.error('--interval must be a number of minutes, 1 or more.');
    return 2;
  }

  const token = loadToken();
  if (!token) {
    console.error(
      `No Product Hunt token found. Create a developer token at https://www.producthunt.com/v2/oauth/applications and put it in .env.launch as ${TOKEN_VAR}=… (or export it).`,
    );
    return 2;
  }
  const client = makeClient(token, Boolean(values.verbose));

  try {
    if (days.length) {
      await researchDays(client, days);
      return 0;
    }
    for (;;) {
      try {
        await watchOnce(client, slug);
      } catch (e) {
        if (values.once || e instanceof AuthError) throw e;
        console.error(`\n${e instanceof Error ? e.message : String(e)} (will retry)`);
      }
      if (values.once) return 0;
      await sleep(interval * 60_000);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

process.exitCode = await main();
