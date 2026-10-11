import { describe, expect, it } from 'vitest';
import { editYaml } from '../src/library/yaml-edit.ts';

const DECK = `# a comment that must stay
schemaVersion: 1
sources: []
slides:
  - id: a
    title: Old title   # trailing comment
    tiles:
      - { value: "€14B", label: Total market }
    points:
      - First point
      - Second point
    tags: [x, y]
    note: "Quoted, with comma"
  - id: b
    title: Second
`;

describe('surgical YAML edits', () => {
  it('changes only the edited values and keeps everything else byte for byte', () => {
    const out = editYaml(DECK, [
      { path: ['slides', 0, 'title'], value: 'New title: with a colon' },
      { path: ['slides', 0, 'points'], value: ['First point', 'Second point', 'Third point'] },
      { path: ['slides', 0, 'tags'], value: ['x', 'y', 'z'] },
      { path: ['slides', 0, 'tiles', 0, 'label'], value: 'Addressable, total' },
      { path: ['slides', 1, 'notes'], value: 'Pause here.' },
    ]);
    expect(out).toBe(`# a comment that must stay
schemaVersion: 1
sources: []
slides:
  - id: a
    title: "New title: with a colon"   # trailing comment
    tiles:
      - { value: "€14B", label: "Addressable, total" }
    points:
      - First point
      - Second point
      - Third point
    tags: [x, y, z]
    note: "Quoted, with comma"
  - id: b
    title: Second
    notes: Pause here.
`);
  });

  it('appends list items, including to an empty flow list', () => {
    const out = editYaml(DECK, [
      { path: ['sources', 0], value: { id: 'report', title: 'Annual report', pages: 12 } },
      { path: ['sources', 1], value: { id: 'model', title: 'Model' } },
    ]);
    expect(out).toContain(`sources:
  - id: report
    title: Annual report
    pages: 12
  - id: model
    title: Model
slides:`);
    expect(out.startsWith('# a comment that must stay\n')).toBe(true);
  });

  it('falls back to re-serialising when there is no safe in-place form', () => {
    const out = editYaml('a: { b: 1 }\n', [{ path: ['a', 'c'], value: 2 }]);
    expect(out).toMatch(/c: 2/);
  });
});
