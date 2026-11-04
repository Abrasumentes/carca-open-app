/**
 * Lógica da liga, sem dependências: usada pela API (fonte da verdade) e pelo site.
 * Todas as funções são puras: recebem uma época e devolvem uma época nova.
 */
import { flipSets, formatSets, parseSetsText, POINTS_LOSS, POINTS_WIN, ScoreError, validateMatch } from './tennis';
import type { Match, Pending, Player, Season, StandingRow, SubmissionLog } from './types';

export class LeagueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeagueError';
  }
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function matchIdFor(a: string, b: string): string {
  return [a, b].sort().join('__');
}

export function playerName(season: Season, id: string | null | undefined): string {
  return season.players.find((p) => p.id === id)?.name ?? id ?? '';
}

export function findMatch(season: Season, a: string, b: string): Match | undefined {
  return season.matches[matchIdFor(a, b)];
}

export function opponentOf(match: Match, playerId: string): string {
  return match.p1 === playerId ? match.p2 : match.p1;
}

/** Resultado na perspetiva de `playerId` (o resultado é guardado na perspetiva do p1). */
export function scoreFor(match: Match, score: string, playerId: string): string {
  return match.p1 === playerId ? score : formatSets(flipSets(parseSetsText(score)));
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function checkDate(playedOn: string, today: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) throw new LeagueError('Data inválida.');
  if (playedOn > today) throw new LeagueError('A data não pode ser no futuro.');
}

function requirePlayer(season: Season, id: string, label: string): Player {
  const p = season.players.find((x) => x.id === id);
  if (!p) throw new LeagueError(`${label} desconhecido.`);
  return p;
}

function requireActive(season: Season): void {
  if (season.status !== 'ativa') throw new LeagueError('Esta época já terminou.');
}

export interface SubmitInput {
  by: string;
  opponent: string;
  playedOn: string;
  /** Na perspetiva de quem submete */
  sets: unknown;
  id: string;
  now: Date;
}

export function submitResult(season: Season, input: SubmitInput): { season: Season; log: SubmissionLog } {
  requireActive(season);
  requirePlayer(season, input.by, 'Jogador');
  requirePlayer(season, input.opponent, 'Adversário');
  if (input.by === input.opponent) throw new LeagueError('Escolhe um adversário diferente de ti.');
  const match = findMatch(season, input.by, input.opponent);
  if (!match) throw new LeagueError('Este jogo não existe nesta época.');
  if (match.status === 'confirmado') throw new LeagueError('Este jogo já tem resultado registado.');
  if (match.status === 'pendente') throw new LeagueError('Já existe um resultado à espera de confirmação para este jogo.');
  checkDate(input.playedOn, isoDate(input.now));

  let result;
  try {
    const raw = Array.isArray(input.sets) ? input.sets : [];
    const sets = match.p1 === input.by ? raw : raw.map((s: unknown) => (Array.isArray(s) ? [s[1], s[0]] : s));
    result = validateMatch(sets);
  } catch (e) {
    if (e instanceof ScoreError) throw new LeagueError(e.message);
    throw e;
  }

  const at = input.now.toISOString();
  const pending: Pending = {
    id: input.id,
    score: result.text,
    playedOn: input.playedOn,
    winner: result.winner === 0 ? match.p1 : match.p2,
    by: input.by,
    at,
  };
  const next = withMatch(season, { ...match, status: 'pendente', pending }, at);
  const log: SubmissionLog = { ...pending, matchId: match.id, state: 'pendente', resolvedBy: null, resolvedAt: null };
  return { season: next, log };
}

function requirePending(season: Season, matchId: string, by: string): { match: Match; pending: Pending } {
  requireActive(season);
  const match = season.matches[matchId];
  if (!match) throw new LeagueError('Jogo não encontrado.');
  if (!match.pending || match.status !== 'pendente') {
    throw new LeagueError('Este jogo já não tem nenhum resultado à espera de confirmação.');
  }
  if (by !== match.p1 && by !== match.p2) throw new LeagueError('Só os jogadores deste jogo podem fazer isto.');
  return { match, pending: match.pending };
}

export function confirmResult(
  season: Season,
  input: { matchId: string; by: string; now: Date },
): { season: Season; pendingId: string } {
  const { match, pending } = requirePending(season, input.matchId, input.by);
  if (pending.by === input.by) throw new LeagueError('Tem de ser o adversário a confirmar o resultado.');
  const next = withMatch(
    season,
    { ...match, status: 'confirmado', score: pending.score, playedOn: pending.playedOn, winner: pending.winner, pending: null },
    input.now.toISOString(),
  );
  return { season: next, pendingId: pending.id };
}

export function rejectResult(
  season: Season,
  input: { matchId: string; by: string; now: Date },
): { season: Season; pendingId: string; state: 'rejeitado' | 'cancelado' } {
  const { match, pending } = requirePending(season, input.matchId, input.by);
  const next = withMatch(season, { ...match, status: 'por_jogar', pending: null }, input.now.toISOString());
  return { season: next, pendingId: pending.id, state: pending.by === input.by ? 'cancelado' : 'rejeitado' };
}

function withMatch(season: Season, match: Match, at: string): Season {
  return { ...season, matches: { ...season.matches, [match.id]: match }, updatedAt: at };
}

/**
 * Classificação: 1 ponto por vitória.
 * Desempate: menos jogos realizados primeiro, depois a ordem da lista de participantes.
 */
export function computeStandings(season: Season): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  season.players.forEach((p) =>
    rows.set(p.id, { pos: 0, playerId: p.id, name: p.name, played: 0, wins: 0, losses: 0, points: 0 }),
  );
  for (const m of Object.values(season.matches)) {
    if (m.status !== 'confirmado' || !m.winner) continue;
    for (const id of [m.p1, m.p2]) {
      const r = rows.get(id);
      if (!r) continue;
      r.played += 1;
      if (m.winner === id) {
        r.wins += 1;
        r.points += POINTS_WIN;
      } else {
        r.losses += 1;
        r.points += POINTS_LOSS;
      }
    }
  }
  const order = new Map(season.players.map((p, i) => [p.id, i]));
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || a.played - b.played || order.get(a.playerId)! - order.get(b.playerId)!,
  );
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    r.pos = prev && prev.points === r.points && prev.played === r.played ? prev.pos : i + 1;
  });
  return sorted;
}

/* ------------------------------------------------------------------ */
/* Importação a partir da folha JOGOS                                  */
/* ------------------------------------------------------------------ */

export interface ImportRow {
  line: number;
  p1: string;
  p2: string;
  date: string;
  result: string;
  winner: string;
}

export interface ImportReport {
  season: Season;
  errors: string[];
  players: number;
  matches: number;
  played: number;
}

/** dd/mm/aaaa (ou aaaa-mm-dd) → aaaa-mm-dd */
export function parseSheetDate(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  return null;
}

export function seasonFromRows(id: string, name: string, rows: ImportRow[], now: Date): ImportReport {
  const errors: string[] = [];
  const players: Player[] = [];
  const byName = new Map<string, Player>();
  const addPlayer = (n: string) => {
    const key = n.trim();
    if (!byName.has(key)) {
      const p = { id: slugify(key), name: key };
      if (players.some((x) => x.id === p.id)) errors.push(`Nomes demasiado parecidos: "${key}".`);
      byName.set(key, p);
      players.push(p);
    }
    return byName.get(key)!;
  };

  const matches: Record<string, Match> = {};
  let played = 0;
  for (const r of rows) {
    if (!r.p1.trim() || !r.p2.trim()) continue;
    const a = addPlayer(r.p1);
    const b = addPlayer(r.p2);
    const where = `Linha ${r.line} (${a.name} vs ${b.name})`;
    if (a.id === b.id) {
      errors.push(`${where}: o jogador não pode jogar contra si próprio.`);
      continue;
    }
    const mid = matchIdFor(a.id, b.id);
    if (matches[mid]) {
      errors.push(`${where}: jogo repetido.`);
      continue;
    }
    const match: Match = { id: mid, p1: a.id, p2: b.id, status: 'por_jogar', playedOn: null, score: null, winner: null, pending: null };
    const hasAny = r.result.trim() || r.winner.trim() || r.date.trim();
    if (hasAny) {
      try {
        if (!r.result.trim()) throw new Error('falta o resultado');
        const res = validateMatch(parseSetsText(r.result));
        const winner = res.winner === 0 ? a : b;
        if (r.winner.trim() && r.winner.trim() !== winner.name) {
          throw new Error(`o vencedor indicado (${r.winner.trim()}) não bate com o resultado ${res.text}`);
        }
        const date = r.date.trim() ? parseSheetDate(r.date) : null;
        if (r.date.trim() && !date) throw new Error(`data inválida (${r.date.trim()})`);
        Object.assign(match, { status: 'confirmado', score: res.text, winner: winner.id, playedOn: date });
        played += 1;
      } catch (e) {
        errors.push(`${where}: ${(e as Error).message}.`);
      }
    }
    matches[mid] = match;
  }

  const n = players.length;
  const expected = (n * (n - 1)) / 2;
  if (n && Object.keys(matches).length !== expected) {
    errors.push(`Esperava ${expected} jogos para ${n} jogadores (todos contra todos), mas encontrei ${Object.keys(matches).length}.`);
  }

  return {
    season: { id, name, status: 'ativa', players, matches, updatedAt: now.toISOString() },
    errors,
    players: n,
    matches: Object.keys(matches).length,
    played,
  };
}
