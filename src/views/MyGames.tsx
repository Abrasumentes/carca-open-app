import { opponentOf, playerName, scoreFor } from '../../shared/league';
import type { Season } from '../../shared/types';
import { ptDate } from './ui';

export function MyGames({ season, me }: { season: Season; me: string }) {
  const games = Object.values(season.matches)
    .filter((m) => m.p1 === me || m.p2 === me)
    .sort((a, b) => playerName(season, opponentOf(a, me)).localeCompare(playerName(season, opponentOf(b, me)), 'pt'));
  const done = games.filter((m) => m.status === 'confirmado').sort((a, b) => (b.playedOn ?? '').localeCompare(a.playedOn ?? ''));
  const pend = games.filter((m) => m.status === 'pendente');
  const todo = games.filter((m) => m.status === 'por_jogar');
  const wins = done.filter((m) => m.winner === me).length;

  return (
    <section className="stack">
      <div className="summary">
        <div>
          <b>{done.length}</b>
          <span>jogados</span>
        </div>
        <div>
          <b>{wins}</b>
          <span>vitórias</span>
        </div>
        <div>
          <b>{pend.length}</b>
          <span>pendentes</span>
        </div>
        <div>
          <b>{todo.length}</b>
          <span>por jogar</span>
        </div>
      </div>

      <div className="card">
        <h2>Jogados</h2>
        {!done.length && <p className="muted">Ainda nenhum.</p>}
        <ul className="list">
          {done.map((m) => {
            const won = m.winner === me;
            return (
              <li key={m.id}>
                <div>
                  <div>vs {playerName(season, opponentOf(m, me))}</div>
                  <div className="muted small">
                    {ptDate(m.playedOn)} · <span className="score">{scoreFor(m, m.score!, me)}</span>
                  </div>
                </div>
                <span className={`tag ${won ? 'win' : 'loss'}`}>{won ? 'Vitória' : 'Derrota'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {pend.length > 0 && (
        <div className="card">
          <h2>A confirmar</h2>
          <ul className="list">
            {pend.map((m) => (
              <li key={m.id}>
                <div>
                  <div>vs {playerName(season, opponentOf(m, me))}</div>
                  <div className="muted small">
                    <span className="score">{scoreFor(m, m.pending!.score, me)}</span> · {m.pending!.by === me ? 'enviado por ti' : 'confirma no separador “Confirmar”'}
                  </div>
                </div>
                <span className="tag pend">a confirmar</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Por jogar</h2>
        {!todo.length && <p className="muted">Já jogaste com toda a gente! 🎉</p>}
        <ul className="list">
          {todo.map((m) => (
            <li key={m.id}>
              <span>{playerName(season, opponentOf(m, me))}</span>
              <span className="tag todo">por jogar</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
