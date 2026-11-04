import { useState } from 'react';
import { opponentOf, playerName, scoreFor } from '../../shared/league';
import type { Match, Season } from '../../shared/types';
import { post } from '../api';
import { ptDate, ptDateTime, type FlashMsg } from './ui';

export function Confirm({ season, me, onDone }: { season: Season; me: string; onDone: (m: FlashMsg) => void }) {
  const mine = Object.values(season.matches).filter((m) => m.pending && (m.p1 === me || m.p2 === me));
  const toConfirm = mine.filter((m) => m.pending!.by !== me);
  const sent = mine.filter((m) => m.pending!.by === me);
  const [busy, setBusy] = useState('');
  const [asking, setAsking] = useState<{ id: string; action: 'reject' | 'cancel' } | null>(null);
  const [error, setError] = useState('');

  const act = async (m: Match, action: 'confirm' | 'reject' | 'cancel') => {
    setBusy(m.id);
    setError('');
    try {
      await post(`/api/results/${action === 'confirm' ? 'confirm' : 'reject'}`, { seasonId: season.id, matchId: m.id, by: me });
      setAsking(null);
      onDone(
        action === 'confirm'
          ? { kind: 'ok', text: 'Confirmado! A classificação já foi atualizada.' }
          : action === 'reject'
            ? { kind: 'info', text: 'Resultado rejeitado. O jogo volta a ficar por registar.' }
            : { kind: 'info', text: 'Resultado cancelado.' },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="stack">
      {error && <div className="msg error">{error}</div>}
      <div className="card stack">
        <h2>À espera da tua confirmação</h2>
        {!toConfirm.length && <p className="muted">Nada para confirmar.</p>}
        {toConfirm.map((m) => {
          const pd = m.pending!;
          const won = pd.winner === me;
          const isAsking = asking?.id === m.id;
          return (
            <div key={m.id} className="pending">
              <div>
                <strong>{playerName(season, pd.by)}</strong> registou <strong className="score">{scoreFor(m, pd.score, me)}</strong>{' '}
                <span className={`tag ${won ? 'win' : 'loss'}`}>{won ? 'ganhaste' : 'perdeste'}</span>
              </div>
              <div className="muted small">
                Jogo de {ptDate(pd.playedOn)} · o teu resultado aparece primeiro · enviado {ptDateTime(pd.at)}
              </div>
              {isAsking ? (
                <div className="ask">
                  <span>Rejeitar este resultado? O jogo volta a ficar por registar.</span>
                  <div className="row">
                    <button className="btn danger" disabled={busy === m.id} onClick={() => act(m, 'reject')}>
                      Sim, rejeitar
                    </button>
                    <button className="btn ghost" onClick={() => setAsking(null)}>
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <button className="btn primary" disabled={busy === m.id} onClick={() => act(m, 'confirm')}>
                    {busy === m.id ? 'A confirmar…' : 'Confirmar'}
                  </button>
                  <button className="btn danger" disabled={busy === m.id} onClick={() => setAsking({ id: m.id, action: 'reject' })}>
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card stack">
        <h2>Enviados por ti</h2>
        {!sent.length && <p className="muted">Nenhum resultado à espera do adversário.</p>}
        {sent.map((m) => {
          const pd = m.pending!;
          const isAsking = asking?.id === m.id;
          return (
            <div key={m.id} className="pending">
              <div className="between">
                <div>
                  vs <strong>{playerName(season, opponentOf(m, me))}</strong> · <span className="score">{scoreFor(m, pd.score, me)}</span>
                  <div className="muted small">{ptDate(pd.playedOn)} · à espera de confirmação</div>
                </div>
                {!isAsking && (
                  <button className="btn ghost" onClick={() => setAsking({ id: m.id, action: 'cancel' })}>
                    Cancelar
                  </button>
                )}
              </div>
              {isAsking && (
                <div className="ask">
                  <span>Cancelar o resultado que enviaste?</span>
                  <div className="row">
                    <button className="btn danger" disabled={busy === m.id} onClick={() => act(m, 'cancel')}>
                      Sim, cancelar
                    </button>
                    <button className="btn ghost" onClick={() => setAsking(null)}>
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
