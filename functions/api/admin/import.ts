/**
 * POST /api/admin/import
 * Cabeçalho: x-admin-key: <ADMIN_KEY>
 * { seasonId, seasonName, text, commit?: boolean, replace?: boolean }
 *
 * Lê a folha JOGOS (colada como texto) e cria/substitui a época.
 * Sem `commit` só mostra o relatório (pré-visualização).
 */
import { LeagueError, seasonFromRows } from '../../../shared/league';
import { parseJogosSheet } from '../../../shared/sheet';
import type { Season } from '../../../shared/types';
import { json, readJson, type Env } from '../../_lib/env';
import { runTransaction } from '../../_lib/firestore';
import { APP_CONFIG_PATH, handle, seasonPath } from '../../_lib/season';

interface Body {
  seasonId: string;
  seasonName: string;
  text: string;
  commit: boolean;
  replace: boolean;
}

function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_KEY) return json({ ok: false, error: 'A secret ADMIN_KEY não está configurada neste ambiente.' }, 503);
  if (!sameKey(request.headers.get('x-admin-key') ?? '', env.ADMIN_KEY)) {
    return json({ ok: false, error: 'Palavra-passe de administração errada.' }, 401);
  }
  const body = await readJson<Body>(request);

  return handle(async () => {
    const seasonId = String(body.seasonId ?? '').trim();
    if (!/^[a-z0-9-]{3,40}$/.test(seasonId)) throw new LeagueError('ID da época inválido (ex.: 2026-27).');
    const parsed = parseJogosSheet(String(body.text ?? ''));
    if (parsed.error) throw new LeagueError(parsed.error);
    const report = seasonFromRows(seasonId, String(body.seasonName || `Carca Open ${seasonId}`), parsed.rows, new Date());

    return runTransaction(env, async (tx) => {
      const existing = await tx.get<Season>(seasonPath(seasonId));
      const pendingNow = existing ? Object.values(existing.matches ?? {}).filter((m) => m.status === 'pendente').length : 0;
      const summary = {
        players: report.players,
        matches: report.matches,
        played: report.played,
        errors: report.errors,
        existing: Boolean(existing),
        existingPending: pendingNow,
        committed: false,
      };
      if (!body.commit) return summary;
      if (report.errors.length) throw new LeagueError('Corrige os erros na folha antes de importar.');
      if (!report.players) throw new LeagueError('A folha não tem jogos.');
      if (existing && !body.replace) throw new LeagueError('Esta época já existe. Marca "substituir" para a reescrever.');
      tx.set(seasonPath(seasonId), report.season as unknown as Record<string, unknown>);
      // A época importada passa a ser a que a app mostra.
      tx.set(APP_CONFIG_PATH, { currentSeason: seasonId, updatedAt: new Date().toISOString() });
      return { ...summary, committed: true };
    });
  });
};
