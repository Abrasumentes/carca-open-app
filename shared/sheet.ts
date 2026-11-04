/**
 * Lê a folha JOGOS colada como texto.
 * Aceita tanto células copiadas diretamente do Google Sheets (separadas por tabulação)
 * como um ficheiro CSV (Ficheiro → Transferir → CSV).
 */
import type { ImportRow } from './league';

function splitLine(line: string, sep: string): string[] {
  if (sep === '\t') return line.split('\t');
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function parseJogosSheet(text: string): { rows: ImportRow[]; error: string | null } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : ',';
  const headerIdx = lines.findIndex((l) => splitLine(l, sep).some((c) => norm(c) === 'jogador 1'));
  if (headerIdx < 0) {
    return { rows: [], error: 'Não encontrei o cabeçalho da folha JOGOS (colunas "Jogador 1", "Jogador 2", "Data", "Resultado", "Vencedor").' };
  }
  const header = splitLine(lines[headerIdx], sep).map(norm);
  const col = (name: string) => header.indexOf(name);
  const idx = { p1: col('jogador 1'), p2: col('jogador 2'), date: col('data'), result: col('resultado'), winner: col('vencedor') };
  const missing = Object.entries(idx).filter(([, v]) => v < 0);
  if (missing.length) {
    return { rows: [], error: 'Faltam colunas na folha JOGOS: precisa de "Jogador 1", "Jogador 2", "Data", "Resultado" e "Vencedor".' };
  }
  const rows: ImportRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitLine(lines[i], sep);
    const get = (k: number) => (c[k] ?? '').trim();
    rows.push({ line: i + 1, p1: get(idx.p1), p2: get(idx.p2), date: get(idx.date), result: get(idx.result), winner: get(idx.winner) });
  }
  return { rows, error: null };
}
