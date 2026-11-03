// Cria dados de exemplo no emulador local do Firestore (nunca em QA/PROD).
// Uso: com `npm run dev` a correr, noutro terminal: npm run seed:local
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = 'demo-carca-open';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const players = Array.from({ length: 8 }, (_, i) => ({ id: `jogador-${i + 1}`, name: `Jogador ${i + 1}` }));

async function put(path, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) };
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

function toValue(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  return { stringValue: String(v) };
}

await put('seasons/2026-27', { name: 'Carca Open 2026/27 (exemplo)', status: 'ativa' });
for (const p of players) await put(`players/${p.id}`, { name: p.name, active: true });
console.log(`Emulador: 1 época e ${players.length} jogadores de exemplo criados.`);
