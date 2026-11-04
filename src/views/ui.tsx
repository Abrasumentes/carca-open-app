import { useEffect, useRef } from 'react';

export type FlashMsg = { kind: 'ok' | 'info' | 'error'; text: string };

export function Flash({ msg }: { msg: FlashMsg | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (msg) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [msg]);
  if (!msg) return null;
  return (
    <div ref={ref} className={`msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>
      {msg.text}
    </div>
  );
}

/** "2026-10-10" → "10/10/2026" */
export function ptDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function ptDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
