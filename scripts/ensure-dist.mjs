// O `wrangler pages dev` precisa que a pasta dist/ exista, mesmo vazia.
// Em desenvolvimento o site é servido pelo Vite; o wrangler só serve /api.
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
