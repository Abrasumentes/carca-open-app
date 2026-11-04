# Configuração inicial (fase F0)

Faz isto uma única vez, num computador. No fim tens QA e PROD a funcionar, cada um com a sua base de dados.

## 1. GitHub

1. O repositório é **público**. No plano grátis do GitHub, os environments, as secrets por environment e a proteção
   de branches só existem em repositórios públicos. O repositório não tem nada secreto: as chaves ficam no GitHub e no
   Cloudflare, e os dados da liga ficam no Firebase.
2. Em **Settings → Environments**, cria dois environments: `qa` e `production`.
   No `production`, ativa **Required reviewers** e escolhe-te a ti, se quiseres aprovar cada deploy de PROD.
   As secrets destes environments são adicionadas no passo 3.
3. Em **Settings → Branches**, adiciona regras para `main` e `develop`:
   - Require a pull request before merging
   - Require status checks to pass: `check` (do workflow CI)

## 2. Firebase: dois projetos

Repete os passos para **`carca-open-qa`** e para **`carca-open-prod`**.

1. Vai a https://console.firebase.google.com e escolhe **Criar projeto**.
   - Nome: `carca-open-qa`. Se o ID já estiver ocupado, aceita o que a Google sugerir e toma nota dele.
   - O Google Analytics pode ficar desligado.
   - Fica no plano **Spark**, que é grátis. Não precisas de ativar faturação.
2. Vai a **Compilação → Firestore Database → Criar base de dados**:
   - Localização: `eur3 (europe-west)`
   - Modo de produção
3. Vai a **Definições do projeto (⚙️) → Geral → As tuas apps → Web (`</>`)**:
   - Nome da app: `carca-open-web`. Não precisas de ativar o Hosting.
   - Copia `apiKey`, `authDomain`, `projectId` e `appId` para `wrangler.toml`:
     o projeto QA vai em `[env.preview.vars]` e o PROD em `[env.production.vars]`.
   - Se o ID do projeto for diferente de `carca-open-qa` ou `carca-open-prod`, atualiza também o `.firebaserc`.
4. Vai a **Definições do projeto → Contas de serviço → Gerar nova chave privada**.
   Descarrega o ficheiro JSON e **não o coloques no repositório**.

## 3. Secrets

Para cada um dos dois ficheiros JSON:

| Onde | Nome | Valor |
| --- | --- | --- |
| GitHub → Settings → Environments → `qa` → Add secret | `FIREBASE_SERVICE_ACCOUNT` | conteúdo do JSON do projeto **QA** |
| GitHub → Settings → Environments → `production` → Add secret | `FIREBASE_SERVICE_ACCOUNT` | conteúdo do JSON do projeto **PROD** |
| Cloudflare → (passo 4) → Preview | `FIREBASE_SERVICE_ACCOUNT` | JSON do projeto **QA** |
| Cloudflare → (passo 4) → Production | `FIREBASE_SERVICE_ACCOUNT` | JSON do projeto **PROD** |

Depois de colocares as chaves nestes quatro sítios, apaga os ficheiros JSON do computador.

## 4. Cloudflare Pages

1. Vai a https://dash.cloudflare.com e escolhe **Workers & Pages → Create → Pages → Connect to Git**.
2. Escolhe o repositório e configura:
   - Project name: `carca-open`. Se estiver ocupado, escolhe outro; esse nome define o endereço `.pages.dev`.
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable (build): `NODE_VERSION` = `22`
3. Em **Settings → Variables and Secrets**, adiciona a secret `FIREBASE_SERVICE_ACCOUNT`
   separadamente em **Production** (JSON de PROD) e em **Preview** (JSON de QA).
   As outras variáveis vêm do `wrangler.toml`.
4. Em **Settings → Builds → Branch control**:
   - Production branch: `main`
   - Preview branches: `develop`, ou "All non-production branches"
5. Faz **Retry deployment** do último deploy, para apanhar as secrets.

O endereço de QA fica `develop.carca-open.pages.dev` e o de PROD fica `carca-open.pages.dev`.

## 5. Primeiro deploy das regras do Firestore

Faz um push para `develop`, ou corre o workflow manualmente em **Actions → Deploy regras do Firestore → Run workflow**.

**Antes do primeiro deploy**, dá à conta de serviço as permissões de que o Firebase CLI precisa.
Faz isto nos dois projetos.

1. Abre https://console.cloud.google.com/iam-admin/iam?project=carca-open-qa (depois repete com `carca-open-prod`).
2. Clica no lápis ✏️ da conta `firebase-adminsdk-…@….iam.gserviceaccount.com`.
3. Adiciona estes três papéis:
   - **Service Usage Consumer**
   - **Firebase Rules Admin**
   - **Cloud Datastore Index Admin**

Sem estes papéis, o deploy falha com `403, Permission denied to get service [firestore.googleapis.com]`.

## 6. Verificar

Abre os endereços de QA e de PROD. A página de verificação deve mostrar:

- o selo **QA** ou **Produção**;
- ✓ Browser lê o Firestore;
- ✓ API fala com o Firestore;
- o ID do projeto certo em cada ambiente.

Se aparecer ✕, a mensagem por baixo indica qual dos passos falhou. Normalmente é uma secret em falta
ou um valor `PREENCHER` que ficou por substituir no `wrangler.toml`.
