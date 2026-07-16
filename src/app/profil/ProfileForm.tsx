'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileForm({ name, nickname }: { name: string; nickname: string }) {
  const router = useRouter();

  const [nick, setNick] = useState(nickname);
  const [nickMsg, setNickMsg] = useState('');
  const [nickErr, setNickErr] = useState('');
  const [nickBusy, setNickBusy] = useState(false);

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  async function saveNick(e: React.FormEvent) {
    e.preventDefault();
    setNickBusy(true); setNickErr(''); setNickMsg('');
    const res = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nick }),
    });
    setNickBusy(false);
    if (res.ok) { setNickMsg('Porecla a fost salvată.'); router.refresh(); }
    else setNickErr((await res.json()).error ?? 'Eroare.');
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true); setPinErr(''); setPinMsg('');
    const res = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPin, newPin }),
    });
    setPinBusy(false);
    if (res.ok) { setPinMsg('PIN-ul a fost schimbat.'); setOldPin(''); setNewPin(''); }
    else setPinErr((await res.json()).error ?? 'Eroare.');
  }

  return (
    <main className="auth">
      <h1>Profilul meu</h1>
      <p className="muted">Nume de login: <strong>{name}</strong> — cu el te loghezi.</p>

      <form onSubmit={saveNick}>
        <h2>Poreclă</h2>
        <input
          placeholder="Porecla ta (max 20)"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={20}
        />
        <p className="notice">Lasă gol ca să revii la numele de login.</p>
        {nickErr && <p className="error">{nickErr}</p>}
        {nickMsg && <p className="ok">{nickMsg}</p>}
        <button type="submit" disabled={nickBusy}>Salvează porecla</button>
      </form>

      <form onSubmit={changePin}>
        <h2>Schimbă PIN-ul</h2>
        <input
          placeholder="PIN actual"
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
          required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password"
        />
        <input
          placeholder="PIN nou (4 cifre)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password"
        />
        {pinErr && <p className="error">{pinErr}</p>}
        {pinMsg && <p className="ok">{pinMsg}</p>}
        <button type="submit" disabled={pinBusy}>Schimbă PIN-ul</button>
      </form>
    </main>
  );
}
