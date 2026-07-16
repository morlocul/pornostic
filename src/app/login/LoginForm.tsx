'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InstallHint from '../InstallHint';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    });
    setBusy(false);
    if (res.ok) { router.push('/'); router.refresh(); }
    else setError((await res.json()).error ?? 'Eroare.');
  }

  return (
    <main className="auth">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="auth-logo" src="/icon.svg" alt="Pornosticul de Folbal" width={112} height={112} />
      <h1>Pornosticul de Folbal</h1>
      <div className="tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Intră</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Înscrie-te</button>
      </div>
      <form onSubmit={submit}>
        <input placeholder="Numele tău" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={20} />
        <input placeholder="PIN (4 cifre)" value={pin} onChange={(e) => setPin(e.target.value)} required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{mode === 'login' ? 'Intră' : 'Creează cont'}</button>
      </form>
      <InstallHint />
    </main>
  );
}
