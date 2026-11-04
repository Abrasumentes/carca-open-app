/**
 * POST /api/results/reject  { seasonId, matchId, by }
 * O adversário rejeita, ou quem enviou cancela. O jogo volta a ficar por jogar.
 */
import { rejectResult } from '../../../shared/league';
import { readJson, type Env } from '../../_lib/env';
import { handle, updateSeason } from '../../_lib/season';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ seasonId: string; matchId: string; by: string }>(request);
  return handle(() =>
    updateSeason(env, body.seasonId, (season) => {
      const now = new Date();
      const pending = season.matches[String(body.matchId)]?.pending;
      const { season: next, pendingId, state } = rejectResult(season, { matchId: String(body.matchId ?? ''), by: String(body.by ?? ''), now });
      const log = { ...pending, id: pendingId, matchId: String(body.matchId), state, resolvedBy: String(body.by), resolvedAt: now.toISOString() };
      return { season: next, logs: [log], result: { state } };
    }),
  );
};
