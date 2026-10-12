import { describe, expect, it } from 'vitest';
import { proofingLanguage } from '../src/backends/pptxgenjs.ts';
import { checkDeck } from '../src/build.ts';
import { formatNumber } from '../src/engine/charts.ts';
import { culture, label, typeset } from '../src/engine/i18n.ts';
import { formatNumber as formatFact } from '../src/library/data.ts';

const NB = ' ';

describe('deck language', () => {
  it('binds Russian short words to the next word and keeps dashes off line starts', () => {
    expect(typeset('Пилот с одним инженером в продакшне', 'ru')).toBe(
      `Пилот с${NB}одним инженером в${NB}продакшне`,
    );
    expect(typeset('и в процессе', 'ru')).toBe(`и${NB}в${NB}процессе`);
    expect(typeset('Сумма одна — каналы разные', 'ru')).toBe(`Сумма одна${NB}— каналы разные`);
    expect(typeset('A pilot in production', 'en')).toBe('A pilot in production');
  });

  it('formats numbers in the deck culture', () => {
    expect(culture('ru')).toBe('ru-RU');
    expect(culture('pt-BR')).toBe('pt-BR');
    expect(formatNumber(1234.5, 1, '%')).toBe('1,234.5%');
    expect(formatNumber(1234.5, 1, '%', false, 'ru')).toBe(`1${NB}234,5%`);
    expect(formatNumber(-3, 0, '', false, 'ru')).toBe('−3');
    expect(formatFact(0.125, '0.0%', 'ru')).toBe('12,5%');
  });

  it('marks PowerPoint text with the deck proofing language', () => {
    const xml = '<a:rPr lang="en-US" altLang="en-US" sz="1200"/><a:endParaRPr lang="en-US"/>';
    expect(proofingLanguage(xml, 'ru-RU')).toBe(
      '<a:rPr lang="ru-RU" altLang="en-US" sz="1200"/><a:endParaRPr lang="ru-RU"/>',
    );
    expect(proofingLanguage(xml, 'en-US')).toBe(xml);
  });

  it('draws SlideCraft labels in the deck language', () => {
    expect(label('ru', 'decision')).toBe('Требуется решение');
    expect(label('ru', 'source')).toBe('Источник:');
    expect(label('pt', 'source')).toBe('Source:');
  });

  it('localises the source prefix and keeps English decks unchanged', () => {
    const en = checkDeck('examples/pitch-deck/deck.yaml').scene!;
    const text = (s: typeof en) =>
      s.slides.flatMap((sl) =>
        sl.nodes.flatMap((n) =>
          n.kind === 'text' && n.role === 'source'
            ? [n.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' ')]
            : [],
        ),
      );
    expect(text(en).every((t) => t.startsWith('Source:') || t.startsWith('Illustrative'))).toBe(
      true,
    );
  });
});
