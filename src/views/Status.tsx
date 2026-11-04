import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebase, type AppConfig } from '../firebase';

type Check = { state: 'loading' } | { state: 'ok'; detail: string } | { state: 'error'; detail: string };

const ENV_LABEL: Record<string, string> = { local: 'Local', qa: 'QA', prod: 'Produção' };

/**
 * Página de estado (#estado): mostra em que ambiente estamos e se
 * o browser e a API conseguem chegar à base de dados desse ambiente.
 */
export function Status() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [browserRead, setBrowserRead] = useState<Check>({ state: 'loading' });
  const [api, setApi] = useState<Check>({ state: 'loading' });

  useEffect(() => {
    getFirebase()
      .then(async ({ config, db }) => {
        setConfig(config);
        const snap = await getDocs(collection(db, 'seasons'));
        const names = snap.docs.map((d) => (d.data().name as string) ?? d.id);
        setBrowserRead({ state: 'ok', detail: names.length ? names.join(', ') : 'Sem épocas criadas ainda' });
      })
      .catch((e: Error) => setBrowserRead({ state: 'error', detail: e.message }));

    fetch('/api/health')
      .then(async (r) => {
        const data = await r.json();
        if (!data.ok) throw new Error(data.error ?? `Erro ${r.status}`);
        setApi({ state: 'ok', detail: `Projeto ${data.projectId} · ${data.seasons.length} época(s)` });
      })
      .catch((e: Error) => setApi({ state: 'error', detail: e.message }));
  }, []);

  const env = config?.env ?? '…';

  return (
    <section className="stack">
      <div className="between">
        <h2>Estado do sistema</h2>
        <span className={`env env-${env}`}>{ENV_LABEL[env] ?? env}</span>
      </div>
      <ul className="checks">
        <CheckRow label="Browser lê o Firestore" check={browserRead} />
        <CheckRow label="API fala com o Firestore" check={api} />
      </ul>
      {config && (
        <p className="meta">
          Base de dados: <code>{config.firebase.projectId}</code>
          {config.emulator && ' (emulador)'}
        </p>
      )}
    </section>
  );
}

function CheckRow({ label, check }: { label: string; check: Check }) {
  const icon = check.state === 'ok' ? '✓' : check.state === 'error' ? '✕' : '…';
  return (
    <li className={`check ${check.state}`}>
      <span className="icon" aria-hidden>
        {icon}
      </span>
      <div>
        <strong>{label}</strong>
        <div className="detail">{check.state === 'loading' ? 'A verificar…' : check.detail}</div>
      </div>
    </li>
  );
}
