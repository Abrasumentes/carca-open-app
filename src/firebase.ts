import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

export interface AppConfig {
  env: 'local' | 'qa' | 'prod' | string;
  emulator: boolean;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string };
}

let cached: Promise<{ config: AppConfig; app: FirebaseApp; db: Firestore }> | null = null;

/** Lê a configuração do ambiente (/api/config) e liga o Firebase uma única vez. */
export function getFirebase() {
  cached ??= (async () => {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`Não consegui ler a configuração (${res.status}).`);
    const config = (await res.json()) as AppConfig;
    const app = initializeApp(config.firebase);
    const db = getFirestore(app);
    if (config.emulator) connectFirestoreEmulator(db, location.hostname, 8080);
    return { config, app, db };
  })();
  return cached;
}
