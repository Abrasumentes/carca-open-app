/**
 * GET /api/config
 * Configuração pública do Firebase para o browser. Vem das variáveis do ambiente
 * (local/QA/PROD), por isso o mesmo build serve em todos os ambientes.
 * Estes valores não são secretos: a segurança está nas regras do Firestore.
 */
import { json, type Env } from '../_lib/env';

export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  json({
    env: env.APP_ENV,
    emulator: Boolean(env.FIRESTORE_EMULATOR_HOST),
    firebase: {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      projectId: env.FIREBASE_PROJECT_ID,
      appId: env.FIREBASE_APP_ID,
    },
  });
