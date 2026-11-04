# Carca Open App

App da liga de ténis Carca Open: classificação, registo de resultados e confirmação pelo adversário.

## O que a app faz

- **Classificação**: a tabela (1 ponto por vitória) e a matriz de jogos todos-contra-todos.
- **Registar**: o jogador escolhe o adversário e os sets. A app valida as regras (sets até 4, 5-3, 5-4 com tie-break,
  super tie-break até 10) e mostra o vencedor.
- **Confirmar**: o resultado só conta depois de o adversário o confirmar. O adversário também pode rejeitar, e
  quem enviou pode cancelar.
- **Meus jogos**: os jogos de cada jogador (jogados, pendentes e por jogar).
- **Administração** (`#admin`): importa a folha JOGOS (copiar e colar) e cria ou substitui a época.
- **Estado** (`#estado`): verifica a ligação à base de dados.

Os dados atualizam-se em tempo real: quando alguém confirma um resultado, a classificação muda no telemóvel de todos.

| Peça | Serviço | Pasta |
| --- | --- | --- |
| Site (React + Vite) | Cloudflare Pages | `src/` |
| API | Cloudflare Pages Functions | `functions/` |
| Regras do ténis e da liga (partilhadas pelo site e pela API) | — | `shared/` |
| Base de dados | Firebase Firestore | `firestore.rules` |
| CI / deploy das regras | GitHub Actions | `.github/workflows/` |

## Ambientes

| Ambiente | Branch | Site | Base de dados |
| --- | --- | --- | --- |
| Local | qualquer | http://localhost:5173 | Emulador (`demo-carca-open`) |
| QA | `develop` | `develop.<projeto>.pages.dev` | `carca-open-qa` |
| PROD | `main` | `<projeto>.pages.dev` | `carca-open-prod` |

A configuração de cada ambiente está em `wrangler.toml`. A única secret, a chave da conta de serviço,
fica no Cloudflare e no GitHub e nunca no repositório.

## Desenvolvimento local

Requisitos: Node 22 e Java 17 ou superior (o Java é usado pelo emulador do Firestore).

```bash
npm install
npm run dev          # emulador + API + site, em http://localhost:5173
npm run seed:local   # noutro terminal: cria uma época de exemplo no emulador
```

A página de administração local é http://localhost:5173/#admin, com a palavra-passe `local-admin`.

## Dados (Firestore)

| Documento | Conteúdo |
| --- | --- |
| `config/app` | `{ currentSeason }`: a época que a app mostra |
| `seasons/{id}` | A época inteira: jogadores e os jogos (estado, resultado, vencedor, resultado pendente) |
| `seasons/{id}/submissions/{id}` | Histórico de cada resultado enviado (confirmado, rejeitado ou cancelado) |

Uma época completa (22 jogadores, 231 jogos) cabe num só documento. Abrir a app custa 2 leituras.
O browser só lê; todas as escritas passam pela API, em transações.

A interface do emulador fica em http://localhost:4000.

Antes de abrir um pull request:

```bash
npm run check        # typecheck + testes + build
```

## Fluxo de trabalho

1. Cria um branch a partir de `develop`, por exemplo `feature/registar-resultado`.
2. Abre um pull request para `develop`. O CI corre os testes.
3. Fazes o merge e o Cloudflare publica em **QA**. Testas lá.
4. Abres um pull request de `develop` para `main`. Com o merge, o Cloudflare publica em **PROD**.

As regras do Firestore são publicadas pelo GitHub Actions no projeto certo
(`develop` vai para QA, `main` vai para PROD).

## Configuração inicial

Ver [docs/SETUP.md](docs/SETUP.md). É feita uma única vez e leva cerca de 30 minutos.
