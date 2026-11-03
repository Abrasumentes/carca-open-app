/**
 * GET /api/health
 * Confirma que a API deste ambiente consegue falar com a base de dados certa.
 */
import { json, type Env } from '../_lib/env';
import { firestoreFetch } from '../_lib/firestore';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const res = await firestoreFetch(env, 'seasons?pageSize=20');
    if (!res.ok) {
      return json({ ok: false, env: env.APP_ENV, error: `Firestore respondeu ${res.status}` }, 502);
    }
    const data = (await res.json()) as { documents?: { name: string }[] };
    return json({
      ok: true,
      env: env.APP_ENV,
      projectId: env.FIREBASE_PROJECT_ID,
      seasons: (data.documents ?? []).map((d) => d.name.split('/').pop()),
    });
  } catch (err) {
    return json({ ok: false, env: env.APP_ENV, error: (err as Error).message }, 500);
  }
};
