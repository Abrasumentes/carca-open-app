/** Variáveis de ambiente das Pages Functions (ver wrangler.toml e as secrets no Cloudflare). */
export interface Env {
  /** "local" | "qa" | "prod" */
  APP_ENV: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_APP_ID: string;
  /** Só em local: "127.0.0.1:8080". Quando existe, a API fala com o emulador. */
  FIRESTORE_EMULATOR_HOST?: string;
  /** Secret (JSON da conta de serviço). Definida no Cloudflare, nunca no git. */
  FIREBASE_SERVICE_ACCOUNT?: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
