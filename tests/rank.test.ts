import { describe, expect, it } from 'vitest';
import { rankStorylines } from '../src/library/rank.ts';

describe('storyline ranking', () => {
  it('suggests a teaching or briefing storyline for an explainer, never a post-mortem', () => {
    const r = rankStorylines({
      task: 'explainer',
      audience: { who: 'managers and engineers' },
      goal: 'Managers and engineers learn the key concepts of LLMs and AI agents before they start AI projects',
    });
    expect(r[0]!.storyline.id).toBe('training-workshop');
    expect(r.slice(0, 3).map((x) => x.storyline.id)).not.toContain('post-mortem');
  });

  it('falls back to general-purpose storylines when no task word matches', () => {
    const r = rankStorylines({
      goal: 'Tell the team about our Q3 numbers',
      audience: { who: 'colleagues' },
    });
    expect(r.slice(0, 3).map((x) => x.storyline.id)).toEqual([
      'strategy-recommendation',
      'research-readout',
      'executive-update',
    ]);
  });
});
