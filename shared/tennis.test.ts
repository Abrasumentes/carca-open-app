import { describe, expect, it } from 'vitest';
import { flipSets, parseSetsText, validateMatch } from './tennis';

describe('validateMatch', () => {
  it.each([
    [[[4, 2], [4, 1]], 0, '4-2; 4-1'],
    [[[5, 3], [5, 4]], 0, '5-3; 5-4'],
    [[[0, 4], [1, 4]], 1, '0-4; 1-4'],
    [[[2, 4], [4, 0], [10, 8]], 0, '2-4; 4-0; 10-8'],
    [[[4, 2], [3, 5], [12, 14]], 1, '4-2; 3-5; 12-14'],
    [[['4', '2'], ['4', '0']], 0, '4-2; 4-0'],
  ])('aceita %j', (sets, winner, text) => {
    const r = validateMatch(sets);
    expect(r.winner).toBe(winner);
    expect(r.text).toBe(text);
  });

  it.each([
    ['4-3 (a 3-3 tem de ir a 5-3)', [[4, 3], [4, 1]], /1\.º set/],
    ['5-2', [[4, 1], [5, 2]], /2\.º set/],
    ['6-4', [[6, 4], [4, 1]], /inválido/],
    ['1-1 sem super tie-break', [[4, 2], [2, 4]], /falta o super tie-break/],
    ['super tie-break a mais', [[4, 2], [4, 2], [10, 5]], /Não há super tie-break/],
    ['super tie-break 10-9', [[4, 2], [2, 4], [10, 9]], /Super tie-break/],
    ['super tie-break 13-10', [[4, 2], [2, 4], [13, 10]], /Super tie-break/],
    ['só um set', [[4, 2]], /dois sets/],
    ['valor vazio', [[4, ''], [4, 1]], /em falta/],
    ['negativo', [[4, -1], [4, 1]], /em falta/],
  ])('rejeita %s', (_name, sets, msg) => {
    expect(() => validateMatch(sets)).toThrow(msg);
  });
});

describe('formatos', () => {
  it('lê o formato da folha', () => {
    expect(parseSetsText('5-3; 4-2')).toEqual([[5, 3], [4, 2]]);
  });
  it('vira o resultado para o outro lado', () => {
    expect(flipSets([[4, 2], [3, 5], [10, 7]])).toEqual([[2, 4], [5, 3], [7, 10]]);
  });
});

describe('tie-breaks escritos na folha', async () => {
  const { validateScoreText, flipScoreText } = await import('./tennis');
  it.each([
    ['5-4 (7-4); 4-2', '5-4 (7-4); 4-2', 0],
    ['5-4; (8-6); 4-1', '5-4 (8-6); 4-1', 0],
    ['4-2; 5-4(7-5)', '4-2; 5-4 (7-5)', 0],
    ['2-4; 4-5 (4-7)', '2-4; 4-5 (4-7)', 1],
    ['4-5 (10-12); 5-4 (7-0); 10-8', '4-5 (10-12); 5-4 (7-0); 10-8', 0],
  ])('aceita %s', (input, text, winner) => {
    const r = validateScoreText(input);
    expect(r.text).toBe(text);
    expect(r.winner).toBe(winner);
  });
  it.each([
    ['(8-6); 4-1', /a que set/],
    ['4-2 (7-4); 4-1', /só há tie-break num set 5-4/],
    ['5-4 (4-7); 4-1', /não bate/],
    ['5-4 (7-6); 4-1', /Tie-break inválido/],
  ])('rejeita %s', (input, msg) => {
    expect(() => validateScoreText(input)).toThrow(msg);
  });
  it('vira o resultado com o tie-break', () => {
    expect(flipScoreText('5-4 (7-4); 2-4; 10-8')).toBe('4-5 (4-7); 4-2; 8-10');
  });
});
