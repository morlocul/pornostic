'use client';
import { useEffect, useRef, useState } from 'react';
import { parseScore, isDirty } from '@/lib/predictInput';

type Score = { home: number; away: number };

// Formularele cu scor scris dar nesalvat. Cât timp există vreunul, plecarea de pe pagină cere confirmare.
const unsaved = new Set<string>();
function warnOnLeave(e: BeforeUnloadEvent) {
  if (unsaved.size === 0) return;
  e.preventDefault();
  e.returnValue = '';
}

const AUTOSAVE_MS = 700;

export default function PredictionForm({ matchId, initialHome, initialAway }:
  { matchId: string; initialHome: number | null; initialAway: number | null }) {
  const [home, setHome] = useState(initialHome?.toString() ?? '');
  const [away, setAway] = useState(initialAway?.toString() ?? '');
  const [saved, setSaved] = useState<Score | null>(
    initialHome != null && initialAway != null ? { home: initialHome, away: initialAway } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const dirty = isDirty(home, away, saved);
  const complete = parseScore(home, away);

  async function save(score: Score) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, home: score.home, away: score.away }),
      });
      if (res.ok) setSaved(score);
      else setError((await res.json().catch(() => ({}))).error ?? 'Nu s-a salvat. Încearcă din nou.');
    } catch {
      setError('Fără conexiune. Pronosticul nu s-a salvat, încearcă din nou.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  // Salvare automată: un scor complet și diferit de cel salvat pleacă singur, după o mică pauză de tastare.
  // Dacă scorul s-a schimbat cât timp se salva, efectul rulează din nou când `saved` sau `busy` se schimbă.
  useEffect(() => {
    if (!complete || !dirty || busy || error) return;
    const t = setTimeout(() => save(complete), AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, saved, busy, error]);

  useEffect(() => {
    if (dirty) unsaved.add(matchId); else unsaved.delete(matchId);
    if (unsaved.size > 0) window.addEventListener('beforeunload', warnOnLeave);
    else window.removeEventListener('beforeunload', warnOnLeave);
    return () => { unsaved.delete(matchId); };
  }, [dirty, matchId]);

  const onChange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setError('');
  };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (complete) save(complete);
  }

  const label = busy ? 'Se salvează…' : dirty ? 'Salvează' : saved ? 'Salvat ✓' : 'Salvează';
  const hint = error ? '' : dirty && !complete ? 'Completează ambele căsuțe' : '';

  return (
    <form className={`predict${dirty && !busy ? ' dirty' : ''}`} onSubmit={onSubmit}>
      <input inputMode="numeric" pattern="\d{1,2}" value={home} onChange={onChange(setHome)} required aria-label="scor gazde" />
      <span>–</span>
      <input inputMode="numeric" pattern="\d{1,2}" value={away} onChange={onChange(setAway)} required aria-label="scor oaspeți" />
      <button disabled={busy}>{label}</button>
      {error && <span className="error" role="alert">{error}</span>}
      {hint && <span className="hint">{hint}</span>}
    </form>
  );
}
