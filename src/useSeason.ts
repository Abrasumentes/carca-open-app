import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Season } from '../shared/types';
import { getFirebase, type AppConfig } from './firebase';

export type SeasonState =
  | { state: 'loading' }
  | { state: 'empty'; config: AppConfig }
  | { state: 'error'; error: string }
  | { state: 'ready'; season: Season; config: AppConfig };

/**
 * A época atual, em tempo real: quando alguém regista ou confirma, todos veem logo.
 * config/app diz qual é a época atual; depois segue-se o documento dessa época.
 */
export function useSeason(): SeasonState {
  const [s, setS] = useState<SeasonState>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    let unsubConfig = () => {};
    let unsubSeason = () => {};
    getFirebase()
      .then(({ db, config }) => {
        if (cancelled) return;
        const fail = (err: Error) => setS({ state: 'error', error: err.message });
        unsubConfig = onSnapshot(
          doc(db, 'config', 'app'),
          (cfg) => {
            unsubSeason();
            const id = cfg.get('currentSeason') as string | undefined;
            if (!id) return setS({ state: 'empty', config });
            unsubSeason = onSnapshot(
              doc(db, 'seasons', id),
              (snap) => setS(snap.exists() ? { state: 'ready', season: snap.data() as Season, config } : { state: 'empty', config }),
              fail,
            );
          },
          fail,
        );
      })
      .catch((e: Error) => setS({ state: 'error', error: e.message }));
    return () => {
      cancelled = true;
      unsubSeason();
      unsubConfig();
    };
  }, []);
  return s;
}
