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

function databasePath(env: Env): string {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

export function documentsUrl(env: Env): string {
  const base = env.FIRESTORE_EMULATOR_HOST
    ? `http://${env.FIRESTORE_EMULATOR_HOST}`
    : 'https://firestore.googleapis.com';
  return `${base}/v1/${databasePath(env)}`;
}

/**
 * Pedido autenticado à API de documentos.
 * `path` é relativo a .../documents: "seasons/2026-27" ou ":commit" (métodos começam por ":").
 */
export async function firestoreFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(env);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  const sep = path.startsWith(':') ? '' : '/';
  return fetch(`${documentsUrl(env)}${sep}${path}`, { ...init, headers });
}

/* ------------------------------------------------------------------ */
/* Conversão JS <-> formato de valores do Firestore                     */
/* ------------------------------------------------------------------ */

type FsValue = Record<string, unknown>;

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  throw new Error(`Tipo não suportado: ${typeof v}`);
}

export function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export function decodeValue(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  return null;
}

export function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/* ------------------------------------------------------------------ */
/* Leitura simples e transações                                        */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function failure(res: Response, what: string): Promise<HttpError> {
  let detail = '';
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
  } catch {
    /* sem corpo */
  }
  return new HttpError(res.status, `${what}: Firestore respondeu ${res.status}${detail ? ` (${detail})` : ''}`);
}

export async function getDoc<T>(env: Env, path: string, transaction?: string): Promise<T | null> {
  // Dentro de uma transação usa-se batchGet: o GET simples com ?transaction= fica preso no emulador.
  if (transaction) {
    const res = await firestoreFetch(env, ':batchGet', {
      method: 'POST',
      body: JSON.stringify({ documents: [`${databasePath(env)}/${path}`], transaction }),
    });
    if (!res.ok) throw await failure(res, `Ler ${path}`);
    const [item] = (await res.json()) as { found?: { fields?: Record<string, FsValue> } }[];
    return item?.found ? (decodeFields(item.found.fields ?? {}) as T) : null;
  }
  const res = await firestoreFetch(env, path);
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, `Ler ${path}`);
  const doc = (await res.json()) as { fields?: Record<string, FsValue> };
  return decodeFields(doc.fields ?? {}) as T;
}

export interface Tx {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: Record<string, unknown>): void;
}

/** Cancela a transação e liberta os bloqueios de leitura. */
function rollback(env: Env, transaction: string) {
  return firestoreFetch(env, ':rollback', { method: 'POST', body: JSON.stringify({ transaction }) }).catch(() => {});
}

const MAX_ATTEMPTS = 5;

/** Demasiados pedidos ao mesmo tempo sobre a mesma época. */
export class BusyError extends Error {
  constructor() {
    super('Muitos pedidos ao mesmo tempo. Tenta outra vez.');
  }
}

/**
 * Corre `fn` numa transação: as leituras ficam bloqueadas até ao commit,
 * por isso dois jogadores a confirmar ao mesmo tempo nunca se pisam.
 * Se o Firestore abortar por conflito, tenta outra vez (até 5 vezes):
 * a nova tentativa volta a ler a época, por isso vê o que o outro gravou.
 */
export async function runTransaction<T>(env: Env, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const begin = await firestoreFetch(env, ':beginTransaction', { method: 'POST', body: '{}' });
    if (!begin.ok) throw await failure(begin, 'Iniciar transação');
    const { transaction } = (await begin.json()) as { transaction: string };
    const writes: unknown[] = [];
    const tx: Tx = {
      get: (path) => getDoc(env, path, transaction),
      set: (path, data) => writes.push({ update: { name: `${databasePath(env)}/${path}`, fields: encodeFields(data) } }),
    };
    let result: T;
    try {
      result = await fn(tx);
    } catch (e) {
      await rollback(env, transaction);
      throw e;
    }
    if (!writes.length) {
      // Só leitura (ex.: pré-visualização): liberta os bloqueios.
      await rollback(env, transaction);
      return result;
    }
    const commit = await firestoreFetch(env, ':commit', { method: 'POST', body: JSON.stringify({ transaction, writes }) });
    if (commit.ok) return result;
    // 409 = conflito com outra transação: espera um tempo aleatório e tenta de novo.
    if (commit.status === 409 && attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, Math.random() * 300 * attempt));
      continue;
    }
    if (commit.status === 409) throw new BusyError();
    throw await failure(commit, 'Gravar');
  }
}
