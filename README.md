# Carca Open App

App da liga de ténis Carca Open: classificação, registo de resultados e confirmação pelo adversário.

| Peça | Serviço | Pasta |
| --- | --- | --- |
| Site (React + Vite) | Cloudflare Pages | `src/` |
| API | Cloudflare Pages Functions | `functions/` |
| Regras do ténis (partilhadas pelo site e pela API) | — | `shared/` |
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
npm run seed:local   # noutro terminal: cria dados de exemplo no emulador
```

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
