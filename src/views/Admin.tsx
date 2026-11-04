import { useState } from 'react';
import { post } from '../api';

interface Report {
  players: number;
  matches: number;
  played: number;
  errors: string[];
  existing: boolean;
  existingPending: number;
  committed: boolean;
}

function load(k: string) {
  try {
    return sessionStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}

/** Importar a folha JOGOS para criar (ou substituir) a época. */
export function Admin() {
  const [key, setKey] = useState(() => load('carca.admin'));
  const [seasonId, setSeasonId] = useState('2026-27');
  const [seasonName, setSeasonName] = useState('Carca Open 2026/27');
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (commit: boolean) => {
    setBusy(true);
    setError('');
    try {
      sessionStorage.setItem('carca.admin', key);
    } catch {
      /* ignorar */
    }
    try {
      const r = await post<Report>('/api/admin/import', { seasonId, seasonName, text, commit, replace }, { 'x-admin-key': key });
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
      if (!commit) setReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack">
      <div className="card stack">
        <h2>Administração · importar jogos</h2>
        <ol className="steps">
          <li>
            Na folha de cálculo, abre o separador <b>JOGOS</b> e seleciona tudo (Ctrl+A), incluindo o cabeçalho “Jogador 1, Jogador 2, Data,
            Resultado, Vencedor”.
          </li>
          <li>Copia (Ctrl+C) e cola aqui em baixo.</li>
          <li>
            Clica em <b>Pré-visualizar</b>. Se não houver erros, clica em <b>Importar</b>.
          </li>
        </ol>
        <label className="field">
          <span>Palavra-passe de administração</span>
          <input id="adminKey" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <div className="two">
          <label className="field">
            <span>ID da época</span>
            <input id="seasonId" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} />
          </label>
          <label className="field">
            <span>Nome da época</span>
            <input id="seasonName" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Folha JOGOS (colada)</span>
          <textarea id="sheet" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'#\tJogador 1\tJogador 2\tData\tResultado\tVencedor\n1\tAna Cardoso\tAnita Martins\t23/09/2026\t5-3; 4-2\tAna Cardoso\n…'} />
        </label>
        <button className="btn ghost" disabled={busy || !text.trim() || !key} onClick={() => run(false)}>
          {busy ? 'A ler…' : 'Pré-visualizar'}
        </button>
        {error && <div className="msg error">{error}</div>}
      </div>

      {report && (
        <div className="card stack">
          <h2>{report.committed ? 'Importação concluída' : 'Pré-visualização'}</h2>
          <p>
            {report.players} jogadores · {report.matches} jogos · {report.played} com resultado
          </p>
          {report.errors.length > 0 ? (
            <div className="msg error">
              <b>{report.errors.length} problema(s) na folha:</b>
              <ul>
                {report.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="msg ok">A folha está válida.</div>
          )}
          {report.committed ? (
            <a className="btn primary" href="#classificacao">
              Ver classificação
            </a>
          ) : (
            <>
              {report.existing && (
                <label className="check">
                  <input id="replace" type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  <span>
                    A época {seasonId} já existe. Substituir tudo pelo conteúdo da folha
                    {report.existingPending > 0 && ` (perdem-se ${report.existingPending} resultado(s) à espera de confirmação)`}.
                  </span>
                </label>
              )}
              <button className="btn primary" disabled={busy || report.errors.length > 0 || (report.existing && !replace)} onClick={() => run(true)}>
                Importar
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
