import { useMemo } from 'react';
import { computeStandings } from '../../shared/league';
import type { Season } from '../../shared/types';

export function Standings({ season, me }: { season: Season; me: string }) {
  const rows = useMemo(() => computeStandings(season), [season]);
  const total = Object.keys(season.matches).length;
  const played = Object.values(season.matches).filter((m) => m.status === 'confirmado').length;

  return (
    <section className="stack">
      <div className="card table-card">
        <table className="standings">
          <thead>
            <tr>
              <th className="n">#</th>
              <th>Jogador</th>
              <th className="n" title="Jogos">J</th>
              <th className="n" title="Vitórias">V</th>
              <th className="n" title="Derrotas">D</th>
              <th className="n" title="Pontos">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className={r.playerId === me ? 'me' : ''}>
                <td className="n muted">{r.pos}</td>
                <td>{r.name}</td>
                <td className="n">{r.played}</td>
                <td className="n">{r.wins}</td>
                <td className="n">{r.losses}</td>
                <td className="n strong">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {played} de {total} jogos realizados · 1 ponto por vitória · desempate: confronto direto, depois menos jogos.
      </p>
    </section>
  );
}
