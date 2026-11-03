/**
 * Regras de pontuação da liga Carca Open.
 *
 * Usado pelo site (validação imediata) e pela API (validação definitiva),
 * por isso existe num só sítio.
 *
 * - Short set até 4. A 3-3 joga-se até 5-3. A 4-4 faz-se tie-break até 7 (o set fica 5-4).
 *   Resultados válidos (vencedor-perdedor): 4-0, 4-1, 4-2, 5-3, 5-4.
 * - A 1-1 em sets, super tie-break até 10 com 2 pontos de diferença.
 * - Vitória = 1 ponto, derrota = 0.
 */

export type SetScore = [number, number];
export type Side = 0 | 1;

export interface MatchResult {
  /** 0 = ganhou o lado A (primeiro número), 1 = ganhou o lado B */
  winner: Side;
  sets: SetScore[];
  /** Formato da folha original: "4-2; 3-5; 10-7" */
  text: string;
}

export class ScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoreError';
  }
}

export const POINTS_WIN = 1;
export const POINTS_LOSS = 0;

const VALID_SETS = '4-0, 4-1, 4-2, 5-3, 5-4';

export function setWinner([a, b]: SetScore, label = 'Set'): Side {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  const ok = (w === 4 && l <= 2) || (w === 5 && (l === 3 || l === 4));
  if (!ok) throw new ScoreError(`${label}: resultado inválido (${a}-${b}). Válidos: ${VALID_SETS}.`);
  return a > b ? 0 : 1;
}

export function superTiebreakWinner([a, b]: SetScore): Side {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  const ok = (w === 10 && l <= 8) || (w > 10 && l === w - 2);
  if (!ok) {
    throw new ScoreError(
      `Super tie-break: resultado inválido (${a}-${b}). Vai até 10 com 2 pontos de diferença (ex.: 10-7, 11-9).`,
    );
  }
  return a > b ? 0 : 1;
}

function toInt(x: unknown, setIndex: number): number {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new ScoreError(`Set ${setIndex + 1}: valores em falta ou inválidos.`);
  }
  return n;
}

/** Valida um jogo completo. Lança ScoreError com uma mensagem pronta a mostrar ao jogador. */
export function validateMatch(input: unknown): MatchResult {
  if (!Array.isArray(input) || input.length < 2 || input.length > 3) {
    throw new ScoreError('Indica os dois sets (e o super tie-break, se houve).');
  }
  const sets = input.map((s, i): SetScore => {
    if (!Array.isArray(s) || s.length !== 2) throw new ScoreError(`Set ${i + 1} incompleto.`);
    return [toInt(s[0], i), toInt(s[1], i)];
  });

  const w1 = setWinner(sets[0], '1.º set');
  const w2 = setWinner(sets[1], '2.º set');
  let winner: Side;
  if (w1 === w2) {
    if (sets.length === 3) throw new ScoreError('Não há super tie-break quando alguém ganha os dois sets.');
    winner = w1;
  } else {
    if (sets.length !== 3) throw new ScoreError('Está 1-1 em sets: falta o super tie-break.');
    winner = superTiebreakWinner(sets[2]);
  }
  return { winner, sets, text: formatSets(sets) };
}

export function formatSets(sets: SetScore[]): string {
  return sets.map(([a, b]) => `${a}-${b}`).join('; ');
}

/** Vira o resultado para o ponto de vista do outro jogador. */
export function flipSets(sets: SetScore[]): SetScore[] {
  return sets.map(([a, b]) => [b, a]);
}

/** Lê o formato da folha ("0-4; 1-4") — usado na migração. */
export function parseSetsText(text: string): SetScore[] {
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(s);
      if (!m) throw new ScoreError(`Não percebo o resultado "${s}".`);
      return [Number(m[1]), Number(m[2])] as SetScore;
    });
}
