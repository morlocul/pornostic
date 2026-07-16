'use client';
import { useState } from 'react';

export default function PredictionForm({ matchId, initialHome, initialAway }:
  { matchId: string; initialHome: number | null; initialAway: number | null }) {
  const [home, setHome] = useState(initialHome?.toString() ?? '');
  const [away, setAway] = useState(initialAway?.toString() ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>(initialHome != null ? 'saved' : 'idle');
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, home: parseInt(home, 10), away: parseInt(away, 10) }),
    });
    if (res.ok) setState('saved');
    else { setState('error'); setMsg((await res.json()).error ?? 'Eroare.'); }
  }

  const onChange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value); if (state === 'saved') setState('idle');
  };

  return (
    <form className="predict" onSubmit={save}>
      <input inputMode="numeric" pattern="\d{1,2}" value={home} onChange={onChange(setHome)} required aria-label="scor gazde" />
      <span>–</span>
      <input inputMode="numeric" pattern="\d{1,2}" value={away} onChange={onChange(setAway)} required aria-label="scor oaspeți" />
      <button disabled={state === 'busy'}>{state === 'saved' ? 'Salvat ✓' : 'Salvează'}</button>
      {state === 'error' && <span className="error">{msg}</span>}
    </form>
  );
}
