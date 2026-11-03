/**
 * Cliente mínimo da API REST do Firestore para Cloudflare Workers.
 * (O firebase-admin não corre em Workers.)
 *
 * - Em local fala com o emulador (FIRESTORE_EMULATOR_HOST), sem credenciais.
 * - Em QA/PROD autentica-se com a conta de serviço (FIREBASE_SERVICE_ACCOUNT).
 */
import { SignJWT, importPKCS8 } from 'jose';
import type { Env } from './env';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let cachedToken: { value: string; expiresAt: number; key: string } | null = null;

async function accessToken(env: Env): Promise<string> {
  if (env.FIRESTORE_EMULATOR_HOST) return 'owner';
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('Falta a secret FIREBASE_SERVICE_ACCOUNT neste ambiente.');
  }
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.key === sa.client_email && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Falhou a autenticação na Google (${res.status}).`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in, key: sa.client_email };
  return data.access_token;
}

export function documentsUrl(env: Env): string {
  const base = env.FIRESTORE_EMULATOR_HOST
    ? `http://${env.FIRESTORE_EMULATOR_HOST}`
    : 'https://firestore.googleapis.com';
  return `${base}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

/** Pedido autenticado à API de documentos. `path` é relativo a .../documents (ex.: "seasons"). */
export async function firestoreFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(env);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(`${documentsUrl(env)}/${path}`, { ...init, headers });
}
