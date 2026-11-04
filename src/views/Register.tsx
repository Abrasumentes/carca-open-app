import { useMemo, useState } from 'react';
import { isoDate, opponentOf, playerName } from '../../shared/league';
import { superTiebreakWinner, setWinner, ScoreError } from '../../shared/tennis';
import type { Season } from '../../shared/types';
import { post } from '../api';
import type { FlashMsg } from './ui';

type Cell = [string, string];

function num(x: string): number | null {
  if (x.trim() === '') return null;
  return /^\d+$/.test(x.trim()) ? Number(x) : NaN;
}

interface Preview {
  kind: 'none' | 'info' | 'error' | 'ok';
  text?: string;
  needStb: boolean;
  winner?: 0 | 1;
  payload?: [number, number][];
}

/** Validação imediata, igual à do servidor. */
function preview(cells: Cell[]): Preview {
  const s = cells.map(([a, b]) => [num(a), num(b)]);
  const filled = (i: number) => s[i][0] !== null && s[i][1] !== null;
  const pair = (i: number): [number, number] => {
    if (s[i].some((x) => Number.isNaN(x))) throw new ScoreError('Usa só números.');
    return [s[i][0]!, s[i][1]!];
  };
  let needStb = false;
  try {
    // Assinala logo um set inválido, sem esperar pelo outro.
    if (filled(0)) setWinner(pair(0), '1.º set');
    if (filled(1)) setWinner(pair(1), '2.º set');
    if (!filled(0) || !filled(1)) return { kind: 'none', needStb };
    const set1 = pair(0);
    const set2 = pair(1);
    const w1 = setWinner(set1, '1.º set');
    const w2 = setWinner(set2, '2.º set');
    if (w1 === w2) return { kind: 'ok', needStb, winner: w1, payload: [set1, set2] };
    needStb = true;
    if (!filled(2)) return { kind: 'info', text: 'Está 1-1 em sets: preenche o super tie-break.', needStb };
    const stb = pair(2);
    return { kind: 'ok', needStb, winner: superTiebreakWinner(stb), payload: [set1, set2, stb] };
  } catch (e) {
    return { kind: 'error', text: (e as Error).message, needStb };
  }
}

export function Register({ season, me, onDone }: { season: Season; me: string; onDone: (m: FlashMsg) => void }) {
  const today = isoDate(new Date());
  const [opp, setOpp] = useState('');
  const [date, setDate] = useState(today);
  const [sets, setSets] = useState<Cell[]>([['', ''], ['', ''], ['', '']]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const free = useMemo(
    () =>
      Object.values(season.matches)
        .filter((m) => (m.p1 === me || m.p2 === me) && m.status === 'por_jogar')
        .map((m) => opponentOf(m, me))
        .sort((a, b) => playerName(season, a).localeCompare(playerName(season, b), 'pt')),
    [season, me],
  );
  const validOpp = free.includes(opp) ? opp : '';
  const p = preview(sets);
  const oppName = playerName(season, validOpp);

  const set = (i: number, j: 0 | 1, v: string) =>
    setSets((prev) => prev.map((c, k) => (k === i ? ((j === 0 ? [v, c[1]] : [c[0], v]) as Cell) : c)));

  const submit = async () => {
    if (!p.payload || !validOpp) return;
    setBusy(true);
    setError('');
    try {
      await post('/api/results/submit', { seasonId: season.id, by: me, opponent: validOpp, playedOn: date, sets: p.payload });
      onDone({ kind: 'ok', text: `Resultado enviado! Agora ${oppName} tem de o confirmar no separador “Confirmar”.` });
      setOpp('');
      setSets([['', ''], ['', ''], ['', '']]);
      setDate(today);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!free.length) {
    return (
      <div className="card">
        <p className="muted">Não tens jogos por registar. Já jogaste com toda a gente ou os resultados estão à espera de confirmação. 🎾</p>
      </div>
    );
  }

  const rows: { label: string; i: number; show: boolean }[] = [
    { label: '1.º set', i: 0, show: true },
    { label: '2.º set', i: 1, show: true },
    { label: 'Super tie-break', i: 2, show: p.needStb },
  ];

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>Registar resultado</h2>
      <label className="field">
        <span>Adversário</span>
        <select id="opp" value={validOpp} onChange={(e) => setOpp(e.target.value)}>
          <option value="">— escolhe —</option>
          {free.map((id) => (
            <option key={id} value={id}>
              {playerName(season, id)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Data do jogo</span>
        <input id="date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <fieldset className="field">
        <legend>Resultado</legend>
        <div className="sets">
          <span />
          <span className="hdr">Eu</span>
          <span />
          <span className="hdr">{oppName ? oppName.split(' ')[0] : 'Adv.'}</span>
          {rows
            .filter((r) => r.show)
            .map((r) => (
              <SetRow key={r.i} label={r.label} cell={sets[r.i]} onChange={(j, v) => set(r.i, j, v)} id={`s${r.i}`} />
            ))}
        </div>
        <p className="hint">Sets até 4 (a 3-3 vai a 5-3; a 4-4 tie-break → 5-4). A 1-1 em sets, super tie-break até 10.</p>
      </fieldset>
      {p.kind === 'ok' && (
        <div className="msg ok">
          Vencedor: <strong>{p.winner === 0 ? playerName(season, me) : oppName || 'adversário'}</strong>
        </div>
      )}
      {(p.kind === 'info' || p.kind === 'error') && <div className={`msg ${p.kind}`}>{p.text}</div>}
      {!validOpp && p.kind === 'ok' && <div className="msg info">Escolhe o adversário.</div>}
      {error && <div className="msg error">{error}</div>}
      <button className="btn primary" type="submit" disabled={busy || p.kind !== 'ok' || !validOpp}>
        {busy ? 'A enviar…' : 'Enviar para confirmação'}
      </button>
      <p className="hint">O resultado só conta depois de o adversário o confirmar.</p>
    </form>
  );
}

function SetRow({ label, cell, onChange, id }: { label: string; cell: Cell; onChange: (j: 0 | 1, v: string) => void; id: string }) {
  return (
    <>
      <span>{label}</span>
      <input id={`${id}a`} inputMode="numeric" aria-label={`${label}, os meus jogos`} value={cell[0]} onChange={(e) => onChange(0, e.target.value)} />
      <span className="dash">–</span>
      <input id={`${id}b`} inputMode="numeric" aria-label={`${label}, jogos do adversário`} value={cell[1]} onChange={(e) => onChange(1, e.target.value)} />
    </>
  );
}
