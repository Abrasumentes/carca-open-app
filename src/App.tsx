import { useEffect, useMemo, useState } from 'react';
import { useSeason } from './useSeason';
import { Standings } from './views/Standings';
import { Matrix } from './views/Matrix';
import { Register } from './views/Register';
import { Confirm } from './views/Confirm';
import { MyGames } from './views/MyGames';
import { Admin } from './views/Admin';
import { Status } from './views/Status';
import { Flash, type FlashMsg } from './views/ui';

const TABS = [
  { id: 'classificacao', label: 'Classificação' },
  { id: 'registar', label: 'Registar' },
  { id: 'confirmar', label: 'Confirmar' },
  { id: 'meus-jogos', label: 'Meus jogos' },
] as const;
type Tab = (typeof TABS)[number]['id'] | 'jogos' | 'admin' | 'estado';
const ALL: Tab[] = [...TABS.map((t) => t.id), 'jogos', 'admin', 'estado'];

const ENV_LABEL: Record<string, string> = { local: 'Local', qa: 'QA', prod: '' };

function readHash(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return ALL.includes(h) ? h : 'classificacao';
}

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sem armazenamento: não faz mal */
  }
}

export default function App() {
  const s = useSeason();
  const [tab, setTab] = useState<Tab>(readHash);
  const [me, setMe] = useState(() => load('carca.me'));
  const [flash, setFlash] = useState<FlashMsg | null>(null);

  useEffect(() => {
    const on = () => setTab(readHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const go = (t: Tab) => {
    setFlash(null);
    location.hash = t;
    setTab(t);
  };

  const season = s.state === 'ready' ? s.season : null;
  const env = s.state === 'ready' || s.state === 'empty' ? s.config.env : '';
  const validMe = season?.players.some((p) => p.id === me) ? me : '';

  const toConfirm = useMemo(
    () =>
      season && validMe
        ? Object.values(season.matches).filter((m) => m.pending && m.pending.by !== validMe && (m.p1 === validMe || m.p2 === validMe)).length
        : 0,
    [season, validMe],
  );

  const choose = (id: string) => {
    setMe(id);
    save('carca.me', id);
    setFlash(null);
  };

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <h1>Carca Open</h1>
            {season && <span className="season-name">{season.name}</span>}
            {ENV_LABEL[env] && <span className={`env env-${env}`}>{ENV_LABEL[env]}</span>}
          </div>
          {season && (
            <label className="who">
              <span>Quem és?</span>
              <select id="me" value={validMe} onChange={(e) => choose(e.target.value)}>
                <option value="">— escolhe o teu nome —</option>
                {[...season.players]
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      </header>

      {season && (
        <nav className="tabs" aria-label="Secções">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id || (t.id === 'classificacao' && tab === 'jogos') ? 'active' : ''}
              onClick={() => go(t.id)}
            >
              {t.label}
              {t.id === 'confirmar' && toConfirm > 0 && <span className="badge">{toConfirm}</span>}
            </button>
          ))}
        </nav>
      )}

      <main className="page">
        <Flash msg={flash} />
        {tab === 'admin' ? (
          <Admin />
        ) : tab === 'estado' ? (
          <Status />
        ) : s.state === 'loading' ? (
          <p className="muted center">A carregar…</p>
        ) : s.state === 'error' ? (
          <div className="card">
            <p className="error-text">Não consegui ler os dados da liga: {s.error}</p>
          </div>
        ) : s.state === 'empty' ? (
          <div className="card stack">
            <h2>Ainda não há época ativa</h2>
            <p className="muted">O administrador tem de importar a folha de jogos na página de administração.</p>
            <a className="btn ghost" href="#admin">
              Abrir administração
            </a>
          </div>
        ) : tab === 'classificacao' || tab === 'jogos' ? (
          <>
            <div className="segmented" role="tablist" aria-label="Vista">
              <button role="tab" aria-selected={tab === 'classificacao'} onClick={() => go('classificacao')}>
                Tabela
              </button>
              <button role="tab" aria-selected={tab === 'jogos'} onClick={() => go('jogos')}>
                Matriz de jogos
              </button>
            </div>
            {tab === 'jogos' ? <Matrix season={s.season} me={validMe} /> : <Standings season={s.season} me={validMe} />}
          </>
        ) : !validMe ? (
          <div className="card">
            <p className="muted">Escolhe primeiro o teu nome em “Quem és?”.</p>
          </div>
        ) : tab === 'registar' ? (
          <Register season={s.season} me={validMe} onDone={setFlash} />
        ) : tab === 'confirmar' ? (
          <Confirm season={s.season} me={validMe} onDone={setFlash} />
        ) : (
          <MyGames season={s.season} me={validMe} />
        )}
      </main>
    </>
  );
}
