/** Shared, native slide chrome: themes own styling; engines only render Scene IR. */
import type { ComposeContext } from '../layouts/types.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import type { Slide } from '../spec/deck.ts';
import type { Run } from './scene.ts';

export function composeHeader(
  ctx: ComposeContext & { diagnostics: Diagnostic[] },
  slide: Slide,
  index: number,
): void {
  const { theme, format, colors: c } = ctx;
  if (theme.chrome.tracker && slide.tracker) {
    ctx.text(
      slide.tracker.toUpperCase(),
      {
        ...format.tracker,
        x: format.tracker.x + (theme.chrome.markerWithTracker ? 0.6 : 0),
        w:
          format.tracker.w -
          (theme.chrome.markerWithTracker ? 0.6 : 0) -
          (theme.chrome.pageBadge ? 0.8 : 0),
      },
      {
        role: 'tracker',
        size: 'small',
        bold: true,
        color: c.accent,
        fixed: true,
        maxLines: 1,
        field: 'tracker',
      },
    );
  }
  if (theme.chrome.accentBar && !(theme.chrome.tracker && slide.tracker))
    ctx.rect(
      { x: format.title.x, y: format.title.y - 0.1, w: 0.55, h: 0.05 },
      { fill: c.accent, role: 'accent-bar' },
    );
  const t = theme.type.title;
  const fitDiags = ctx.diagnostics.length;
  const titleNode = ctx.text(slide.title, format.title, {
    role: 'title',
    font: 'heading',
    sizes: [t, t - 2],
    bold: theme.type.titleWeight === 'bold',
    color: c.titleInk ?? c.ink,
    maxLines: 2,
    lineHeight: 1.12,
    field: 'title',
  });
  // Replace generic fit errors on titles with the title-specific code.
  const added = ctx.diagnostics.splice(fitDiags);
  if (added.some((d) => d.code === 'SC-FIT-001' || d.code === 'SC-FIT-003')) {
    ctx.diagnostics.push(
      diag(
        'SC-TITLE-001',
        `Title needs ${titleNode.lines.length} lines at ${titleNode.style.size}pt`,
        {
          slide: slide.id,
          pointer: ctx.ptr('title'),
          measured: `${slide.title.length} chars`,
          limit: '2 lines (~90 chars)',
        },
      ),
    );
  }
  if (theme.chrome.titleRule) {
    const yRule = format.title.y + format.title.h + 0.04;
    ctx.line(
      format.title.x,
      yRule,
      format.title.x + format.title.w,
      yRule,
      {
        color: c.rule,
        width: 0.75,
      },
      { role: 'chrome-title-rule' },
    );
  }
  if (slide.lead)
    ctx.text(slide.lead, format.lead, {
      role: 'lead',
      size: 'subtitle',
      color: c.muted,
      maxLines: 1,
      field: 'lead',
    });

  const words = slide.title.trim().split(/\s+/).length;
  if (words < 5)
    ctx.issue(
      diag(
        'SC-TITLE-002',
        `Title "${slide.title}" has ${words} words — likely a topic, not a claim`,
        { pointer: ctx.ptr('title') },
      ),
    );
  if (/[.]$/.test(slide.title.trim()))
    ctx.issue(diag('SC-TITLE-003', 'Title ends with a period', { pointer: ctx.ptr('title') }));
  const rail = theme.chrome.sideRail;
  if (rail)
    ctx.rect(
      { x: 0, y: 0, w: rail.width, h: format.h },
      { fill: rail.color ?? c.accent, radius: rail.radius, role: 'chrome-side-rail' },
    );
  if (theme.chrome.accentBar && theme.chrome.markerWithTracker && slide.tracker) {
    ctx.rect(
      { x: format.tracker.x, y: format.tracker.y + 0.07, w: 0.35, h: 0.055 },
      { fill: c.accent, radius: 0.025, role: 'chrome-section-marker' },
    );
  }
  if (theme.chrome.pageNumbers && theme.chrome.pageBadge) {
    const badge = theme.chrome.pageBadge;
    const box = {
      x: format.w - format.margin.r - 0.58,
      y: format.tracker.y - 0.035,
      w: 0.58,
      h: 0.33,
    };
    ctx.rect(box, { fill: badge.fill ?? c.ink, radius: 0.165, role: 'chrome-page-badge' });
    ctx.text(String(index + 1).padStart(badge.minDigits, '0'), box, {
      size: 'small',
      bold: true,
      color: badge.color ?? c.background,
      align: 'center',
      valign: 'middle',
      fixed: true,
      maxLines: 1,
      role: 'chrome-page-number',
    });
  }
}

export function composeSource(ctx: ComposeContext, runs: Run[]): void {
  const style = ctx.theme.chrome.sources;
  if (style?.visible === false) return;
  ctx.text([{ runs }], ctx.format.source, {
    role: 'source',
    size: style?.size ?? 'source',
    color: style?.color ?? ctx.colors.muted,
    maxLines: 2,
    valign: 'bottom',
    field: 'sources',
  });
}

export function composeTakeaway(ctx: ComposeContext, text: string, y: number): void {
  const style = ctx.theme.chrome.takeaway;
  const height = style?.height ?? 0.65;
  const box = { x: ctx.body.x, y, w: ctx.body.w, h: height };
  ctx.rect(box, {
    fill: style?.fill ?? ctx.colors.accentSoft,
    radius: style?.radius ?? 0.06,
    role: 'chrome-takeaway-band',
  });
  ctx.rect(
    { ...box, w: 0.07 },
    { fill: style?.accent ?? ctx.colors.accent, radius: 0.035, role: 'chrome-takeaway-accent' },
  );
  ctx.text(
    text,
    { x: box.x + 0.23, y: box.y + 0.08, w: box.w - 0.43, h: box.h - 0.16 },
    {
      role: 'chrome-takeaway',
      size: 'body',
      bold: true,
      color: style?.color ?? ctx.colors.accent,
      maxLines: 2,
      valign: 'middle',
      field: 'bottomLine',
    },
  );
}
