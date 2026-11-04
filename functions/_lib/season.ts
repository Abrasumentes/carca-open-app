import { LeagueError } from '../../shared/league';
import type { Season, SubmissionLog } from '../../shared/types';
import { json, type Env } from './env';
import { BusyError, HttpError, runTransaction, type Tx } from './firestore';

/** Documento com a época que a app mostra: { currentSeason } */
export const APP_CONFIG_PATH = 'config/app';
export const seasonPath = (id: string) => `seasons/${encodeURIComponent(id)}`;
export const submissionPath = (seasonId: string, id: string) => `${seasonPath(seasonId)}/submissions/${encodeURIComponent(id)}`;

/** Lê a época dentro de uma transação, aplica `fn` e grava o resultado. */
export async function updateSeason<T>(
  env: Env,
  seasonId: unknown,
  fn: (season: Season, tx: Tx) => { season: Season; logs?: Partial<SubmissionLog>[]; result: T },
): Promise<T> {
  if (typeof seasonId !== 'string' || !seasonId) throw new LeagueError('Falta indicar a época.');
  return runTransaction(env, async (tx) => {
    const season = await tx.get<Season>(seasonPath(seasonId));
    if (!season) throw new LeagueError('Época não encontrada.');
    const out = fn(season, tx);
    tx.set(seasonPath(seasonId), out.season as unknown as Record<string, unknown>);
    for (const log of out.logs ?? []) {
      if (log.id) tx.set(submissionPath(seasonId, log.id), log as Record<string, unknown>);
    }
    return out.result;
  });
}

/** Converte erros em respostas: erros de regras → 400 com a mensagem; o resto → 500. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return json({ ok: true, ...((await fn()) as object) });
  } catch (e) {
    if (e instanceof LeagueError) return json({ ok: false, error: e.message }, 400);
    if (e instanceof BusyError) return json({ ok: false, error: e.message }, 409);
    const status = e instanceof HttpError ? 502 : 500;
    console.error(e);
    return json({ ok: false, error: 'Erro no servidor. Tenta outra vez daqui a pouco.' }, status);
  }
}
