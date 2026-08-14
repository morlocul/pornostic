'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Match } from '@/lib/db';

type Run = { id: number; ran_at: string; source: string; ok: boolean; message: string | null; upserted: number };
type PlayerRow = { id: string; name: string; nickname: string | null; active?: boolean };

function PlayerPinRow({ p, onChanged }: { p: PlayerRow; onChanged: () => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const retired = p.active === false;

  async function reset() {
    if (!/^\d{4}$/.test(pin)) { setMsg('4 cifre.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: p.id, newPin: pin }),
    });
    setBusy(false);
    if (res.ok) { setMsg('✔ resetat'); setPin(''); }
    else setMsg((await res.json()).error ?? 'Eroare.');
  }

  async function setActive(active: boolean) {
    if (!active && !confirm(`Scoți «${p.nickname ?? p.name}» din joc? Punctele lui rămân în clasament, dar nu mai poate pune pronosticuri. (reversibil)`)) return;
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: p.id, active }),
    });
    setBusy(false);
    if (res.ok) onChanged();
    else setMsg((await res.json()).error ?? 'Eroare.');
  }

  return (
    <div className="row" style={retired ? { opacity: 0.6 } : undefined}>
      <span style={{ flex: 1 }}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}{retired ? ' — retras' : ''}</span>
      <input className="score" style={{ width: 70 }} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN nou" inputMode="numeric" maxLength={4} />
      <button onClick={reset} disabled={busy}>Resetează</button>
      {retired
        ? <button onClick={() => setActive(true)} disabled={busy}>Reactivează</button>
        : <button onClick={() => setActive(false)} disabled={busy}>Scoate din joc</button>}
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}

function MatchRow({ m, onSaved }: { m: Match; onSaved: () => void }) {
  const [home, setHome] = useState(m.home_score?.toString() ?? '');
  const [away, setAway] = useState(m.away_score?.toString() ?? '');
  const [status, setStatus] = useState(m.status);
  const [locked, setLocked] = useState(m.locked_manual);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch('/api/admin/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: m.id,
        home_score: home === '' ? null : parseInt(home, 10),
        away_score: away === '' ? null : parseInt(away, 10),
        status, locked_manual: locked,
      }),
    });
    setBusy(false); onSaved();
  }

  return (
    <div className="row">
      <span style={{ minWidth: 30 }}>E{m.round}</span>
      <span style={{ flex: 1 }}>{m.home_team} – {m.away_team}</span>
      <input className="score" value={home} onChange={(e) => setHome(e.target.value)} placeholder="-" />
      <input className="score" value={away} onChange={(e) => setAway(e.target.value)} placeholder="-" />
      <select value={status} onChange={(e) => setStatus(e.target.value as Match['status'])}>
        <option value="scheduled">programat</option>
        <option value="finished">jucat</option>
        <option value="postponed">amânat</option>
      </select>
      <label><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> fixat</label>
      <button onClick={save} disabled={busy}>Salvează</button>
    </div>
  );
}

export default function AdminPanel({ matches, runs, players }: { matches: Match[]; runs: Run[]; players: PlayerRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [nm, setNm] = useState({ round: '', home: '', away: '', kickoff: '' });
  const rounds = [...new Set(matches.map((m) => m.round))];
  const [shownRound, setShownRound] = useState<number | null>(rounds[0] ?? null);

  async function runScraper() {
    setMsg('Rulează…');
    const res = await fetch('/api/admin/scrape', { method: 'POST' });
    const j = await res.json();
    setMsg(`${j.ok ? '✔' : '✖'} ${j.source}: ${j.message}`);
    router.refresh();
  }

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        create: true, round: parseInt(nm.round, 10), home_team: nm.home, away_team: nm.away,
        kickoff_at: new Date(nm.kickoff).toISOString(),
      }),
    });
    if (res.ok) { setNm({ round: '', home: '', away: '', kickoff: '' }); router.refresh(); }
    else setMsg((await res.json()).error ?? 'Eroare.');
  }

  return (
    <main className="admin">
      <h1>Admin</h1>
      <div className="row">
        <button onClick={runScraper}>Rulează scraperul acum</button>
        {msg && <span className="muted">{msg}</span>}
      </div>

      <h2>Meciuri</h2>
      <div className="row">
        <select value={shownRound ?? ''} onChange={(e) => setShownRound(parseInt(e.target.value, 10))}>
          {rounds.map((r) => <option key={r} value={r}>Etapa {r}</option>)}
        </select>
      </div>
      {matches.filter((m) => m.round === shownRound).map((m) => (
        <MatchRow key={m.id} m={m} onSaved={() => router.refresh()} />
      ))}

      <h2>Adaugă meci manual</h2>
      <form className="row" onSubmit={addMatch}>
        <input style={{ width: 60 }} placeholder="Etapa" value={nm.round} onChange={(e) => setNm({ ...nm, round: e.target.value })} required />
        <input placeholder="Gazde" value={nm.home} onChange={(e) => setNm({ ...nm, home: e.target.value })} required />
        <input placeholder="Oaspeți" value={nm.away} onChange={(e) => setNm({ ...nm, away: e.target.value })} required />
        <input type="datetime-local" value={nm.kickoff} onChange={(e) => setNm({ ...nm, kickoff: e.target.value })} required />
        <button type="submit">Adaugă</button>
      </form>

      <h2>Jucători</h2>
      <p className="muted">Resetează PIN-ul unui prieten care l-a uitat, sau scoate din joc pe cine a renunțat (punctele lui rămân în clasament, e reversibil).</p>
      {players.map((p) => <PlayerPinRow key={p.id} p={p} onChanged={() => router.refresh()} />)}

      <h2>Ultimele rulări scraper</h2>
      {runs.map((r) => (
        <p key={r.id} className={r.ok ? 'ok' : 'error'}>
          {new Date(r.ran_at).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })} — {r.source}: {r.message} ({r.upserted})
        </p>
      ))}
    </main>
  );
}
