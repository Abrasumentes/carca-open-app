/** Modelo de dados da liga. Uma época é um único documento no Firestore: seasons/{id}. */

export interface Player {
  id: string;
  name: string;
}

export type MatchStatus = 'por_jogar' | 'pendente' | 'confirmado';

/** Resultado enviado por um jogador, à espera que o adversário confirme. */
export interface Pending {
  id: string;
  /** Na perspetiva do p1, ex.: "4-2; 3-5; 10-7" */
  score: string;
  /** AAAA-MM-DD */
  playedOn: string;
  winner: string;
  by: string;
  /** ISO 8601 */
  at: string;
}

export interface Match {
  id: string;
  p1: string;
  p2: string;
  status: MatchStatus;
  playedOn: string | null;
  /** Na perspetiva do p1 */
  score: string | null;
  winner: string | null;
  pending: Pending | null;
}

export interface Season {
  id: string;
  name: string;
  status: 'ativa' | 'terminada';
  /** Pela ordem da folha original */
  players: Player[];
  matches: Record<string, Match>;
  updatedAt: string;
}

/** Registo histórico de cada submissão (seasons/{id}/submissions/{id}). */
export interface SubmissionLog {
  id: string;
  matchId: string;
  score: string;
  playedOn: string;
  winner: string;
  by: string;
  at: string;
  state: 'pendente' | 'confirmado' | 'rejeitado' | 'cancelado';
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface StandingRow {
  pos: number;
  playerId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
}
