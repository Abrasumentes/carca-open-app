import { useState } from 'react';
import { findMatch, playerName, scoreFor } from '../../shared/league';
import type { Season } from '../../shared/types';
import { ptDate } from './ui';

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
}

/** Matriz todos-contra-todos, como a folha MATCHES. */
export function Matrix({ season, me }: { season: Season; me: string }) {
  const players = season.players;
  const [sel, setSel] = useState<[string, string] | null>(null);
  const selMatch = sel ? findMatch(season, sel[0], sel[1]) : undefined;
  const pick = (a: string, b: string) => setSel(sel && sel[0] === a && sel[1] === b ? null : [a, b]);

  return (
    <section className="stack">
      {sel && selMatch && (
        <div className="card cell-info" role="status">
          <strong>
            {playerName(season, sel[0])} vs {playerName(season, sel[1])}
          </strong>
          <span className="muted">
            {selMatch.status === 'confirmado' && selMatch.score
              ? `${scoreFor(selMatch, selMatch.score, sel[0])} · ${selMatch.winner === sel[0] ? 'vitória' : 'derrota'} · ${ptDate(selMatch.playedOn)}`
              : selMatch.status === 'pendente'
                ? 'Resultado à espera de confirmação'
                : 'Por jogar'}
          </span>
        </div>
      )}
      <div className="legend">
        <span>
          <i className="dot done" /> jogado
        </span>
        <span>
          <i className="dot pend" /> a confirmar
        </span>
        <span>
          <i className="dot todo" /> por jogar
        </span>
      </div>
      <div className="card matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner" />
              {players.map((p) => (
                <th key={p.id} className={`col ${p.id === me ? 'me' : ''}`} title={p.name}>
                  {initials(p.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((row) => (
              <tr key={row.id} className={row.id === me ? 'me' : ''}>
                <th className="rowh">{row.name}</th>
                {players.map((col) => {
                  if (row.id === col.id) return <td key={col.id} className="self" />;
                  const m = findMatch(season, row.id, col.id);
                  if (!m) return <td key={col.id} />;
                  const on = { onClick: () => pick(row.id, col.id), 'aria-selected': sel?.[0] === row.id && sel?.[1] === col.id };
                  if (m.status === 'confirmado' && m.score) {
                    const won = m.winner === row.id;
                    const title = `${row.name} vs ${col.name}: ${scoreFor(m, m.score, row.id)} (${ptDate(m.playedOn)})`;
                    return (
                      <td key={col.id} className={`done ${won ? 'w' : 'l'}`} title={title} {...on}>
                        {won ? 'V' : 'D'}
                      </td>
                    );
                  }
                  if (m.status === 'pendente') return <td key={col.id} className="pend" title={`${row.name} vs ${col.name}: a confirmar`} {...on} />;
                  return <td key={col.id} className="todo" title={`${row.name} vs ${col.name}: por jogar`} {...on} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Cada linha mostra os jogos desse jogador: V = vitória, D = derrota. Toca numa célula para ver o resultado.</p>
    </section>
  );
}
