/**
 * POST /api/results/submit
 * { seasonId, by, opponent, playedOn: "AAAA-MM-DD", sets: [[eu, adv], [eu, adv], ([eu, adv])] }
 */
import { submitResult } from '../../../shared/league';
import { readJson, type Env } from '../../_lib/env';
import { handle, updateSeason } from '../../_lib/season';

interface Body {
  seasonId: string;
  by: string;
  opponent: string;
  playedOn: string;
  sets: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  return handle(() =>
    updateSeason(env, body.seasonId, (season) => {
      const { season: next, log } = submitResult(season, {
        by: String(body.by ?? ''),
        opponent: String(body.opponent ?? ''),
        playedOn: String(body.playedOn ?? ''),
        sets: body.sets,
        id: crypto.randomUUID(),
        now: new Date(),
      });
      return { season: next, logs: [log], result: { matchId: log.matchId } };
    }),
  );
};
