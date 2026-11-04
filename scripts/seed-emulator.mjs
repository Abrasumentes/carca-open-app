// Cria uma época de exemplo no ambiente local (emulador), através da API de importação.
// Uso: com `npm run dev` a correr, noutro terminal: npm run seed:local
// Nunca toca em QA/PROD: fala só com http://127.0.0.1:8788 e usa a ADMIN_KEY local.
const API = process.env.API_URL ?? 'http://127.0.0.1:8788';

const names = Array.from({ length: 10 }, (_, i) => `Jogador ${String.fromCharCode(65 + i)}`);
const results = {
  '0-1': ['20/09/2026', '4-2; 4-1', 'Jogador A'],
  '0-2': ['22/09/2026', '2-4; 5-3; 10-7', 'Jogador A'],
  '1-2': ['25/09/2026', '3-5; 2-4', 'Jogador C'],
  '3-4': ['01/10/2026', '5-4; 4-0', 'Jogador D'],
};

const lines = [['#', 'Jogador 1', 'Jogador 2', 'Data', 'Resultado', 'Vencedor'].join('\t')];
let n = 1;
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++) lines.push([n++, names[i], names[j], ...(results[`${i}-${j}`] ?? ['', '', ''])].join('\t'));

const res = await fetch(`${API}/api/admin/import`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-admin-key': 'local-admin' },
  body: JSON.stringify({ seasonId: 'exemplo', seasonName: 'Época de exemplo', text: lines.join('\n'), commit: true, replace: true }),
});
const data = await res.json();
if (!data.ok) {
  console.error('Falhou:', data.error);
  process.exit(1);
}
console.log(`Época de exemplo criada: ${data.players} jogadores, ${data.matches} jogos, ${data.played} com resultado.`);
