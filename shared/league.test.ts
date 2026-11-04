import { describe, expect, it } from 'vitest';
import {
  computeStandings,
  confirmResult,
  matchIdFor,
  rejectResult,
  scoreFor,
  seasonFromRows,
  slugify,
  submitResult,
} from './league';
import { parseJogosSheet } from './sheet';

const NAMES = ['Ana Cardoso', 'Anita Martins', 'Bruno Cachola', 'João Cascais'];
const now = new Date('2026-11-04T12:00:00Z');

function sheet(results: Record<string, [string, string, string]> = {}, sep = ','): string {
  const lines = [['#', 'Jogador 1', 'Jogador 2', 'Data', 'Resultado', 'Vencedor'].join(sep)];
  let n = 1;
  for (let i = 0; i < NAMES.length; i++)
    for (let j = i + 1; j < NAMES.length; j++) {
      const r = results[`${i}-${j}`] ?? ['', '', ''];
      const cells = [String(n++), NAMES[i], NAMES[j], ...r];
      lines.push(sep === ',' ? cells.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',') : cells.join(sep));
    }
  return lines.join('\n');
}

function season(results?: Record<string, [string, string, string]>) {
  const { rows } = parseJogosSheet(sheet(results));
  return seasonFromRows('2026-27', 'Teste', rows, now);
}

describe('importação da folha JOGOS', () => {
  it('lê CSV e células copiadas (tabulação)', () => {
    for (const sep of [',', '\t']) {
      const r = parseJogosSheet(sheet({ '0-1': ['23/09/2026', '5-3; 4-2', 'Ana Cardoso'] }, sep));
      expect(r.error).toBeNull();
      expect(r.rows).toHaveLength(6);
      expect(r.rows[0]).toMatchObject({ p1: 'Ana Cardoso', p2: 'Anita Martins', result: '5-3; 4-2' });
    }
  });

  it('cria jogadores, jogos e resultados', () => {
    const rep = season({ '0-1': ['23/09/2026', '5-3; 4-2', 'Ana Cardoso'], '0-3': ['10/10/2026', '0-4; 0-4', 'João Cascais'] });
    expect(rep.errors).toEqual([]);
    expect(rep.players).toBe(4);
    expect(rep.matches).toBe(6);
    expect(rep.played).toBe(2);
    const m = rep.season.matches[matchIdFor('ana-cardoso', 'joao-cascais')];
    expect(m).toMatchObject({ status: 'confirmado', score: '0-4; 0-4', winner: 'joao-cascais', playedOn: '2026-10-10' });
  });

  it('assinala vencedor que não bate com o resultado', () => {
    const rep = season({ '0-1': ['23/09/2026', '5-3; 4-2', 'Anita Martins'] });
    expect(rep.errors[0]).toMatch(/não bate/);
  });

  it('assinala resultados inválidos', () => {
    const rep = season({ '0-1': ['23/09/2026', '4-3; 4-2', 'Ana Cardoso'] });
    expect(rep.errors[0]).toMatch(/Linha 2.*inválido/);
  });

  it('sem cabeçalho dá erro claro', () => {
    expect(parseJogosSheet('a,b,c').error).toMatch(/cabeçalho/);
  });
});

describe('registar, confirmar e rejeitar', () => {
  const base = season().season;
  const ana = 'ana-cardoso';
  const joao = 'joao-cascais';
  const mid = matchIdFor(ana, joao);

  it('slug sem acentos', () => expect(slugify('João Cascais')).toBe('joao-cascais'));

  it('o p2 regista do seu lado e fica guardado do lado do p1', () => {
    const { season: s, log } = submitResult(base, { by: joao, opponent: ana, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'x', now });
    const m = s.matches[mid];
    expect(m.status).toBe('pendente');
    expect(m.pending).toMatchObject({ score: '0-4; 1-4', winner: joao, by: joao });
    expect(scoreFor(m, m.pending!.score, joao)).toBe('4-0; 4-1');
    expect(log.state).toBe('pendente');
  });

  it('só o adversário confirma', () => {
    const { season: s } = submitResult(base, { by: joao, opponent: ana, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'x', now });
    expect(() => confirmResult(s, { matchId: mid, by: joao, now })).toThrow(/adversário/);
    expect(() => confirmResult(s, { matchId: mid, by: 'bruno-cachola', now })).toThrow(/Só os jogadores/);
    const { season: c } = confirmResult(s, { matchId: mid, by: ana, now });
    expect(c.matches[mid]).toMatchObject({ status: 'confirmado', score: '0-4; 1-4', winner: joao, pending: null });
    expect(() => confirmResult(c, { matchId: mid, by: ana, now })).toThrow(/já não tem/);
    expect(() => submitResult(c, { by: ana, opponent: joao, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'y', now })).toThrow(/já tem resultado/);
  });

  it('rejeitar / cancelar volta a "por jogar"', () => {
    const { season: s } = submitResult(base, { by: joao, opponent: ana, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'x', now });
    expect(rejectResult(s, { matchId: mid, by: ana, now }).state).toBe('rejeitado');
    const c = rejectResult(s, { matchId: mid, by: joao, now });
    expect(c.state).toBe('cancelado');
    expect(c.season.matches[mid]).toMatchObject({ status: 'por_jogar', pending: null });
  });

  it('não deixa registar duas vezes, datas futuras nem resultados inválidos', () => {
    const { season: s } = submitResult(base, { by: joao, opponent: ana, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'x', now });
    expect(() => submitResult(s, { by: ana, opponent: joao, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'y', now })).toThrow(/à espera/);
    expect(() => submitResult(base, { by: ana, opponent: joao, playedOn: '2026-11-05', sets: [[4, 0], [4, 1]], id: 'y', now })).toThrow(/futuro/);
    expect(() => submitResult(base, { by: ana, opponent: joao, playedOn: '2026-11-01', sets: [[4, 3], [4, 1]], id: 'y', now })).toThrow(/inválido/);
    expect(() => submitResult(base, { by: ana, opponent: ana, playedOn: '2026-11-01', sets: [[4, 0], [4, 1]], id: 'y', now })).toThrow(/diferente/);
  });
});

describe('classificação', () => {
  it('pontos, depois menos jogos, depois ordem da lista', () => {
    const rep = season({
      '0-1': ['23/09/2026', '4-0; 4-0', 'Ana Cardoso'],
      '0-2': ['24/09/2026', '0-4; 0-4', 'Bruno Cachola'],
      '2-3': ['25/09/2026', '4-0; 4-0', 'Bruno Cachola'],
      '1-3': ['26/09/2026', '4-0; 4-0', 'Anita Martins'],
    });
    const t = computeStandings(rep.season);
    expect(t.map((r) => [r.pos, r.name, r.played, r.points])).toEqual([
      [1, 'Bruno Cachola', 2, 2],
      [2, 'Ana Cardoso', 2, 1],
      [2, 'Anita Martins', 2, 1],
      [4, 'João Cascais', 2, 0],
    ]);
  });
});
