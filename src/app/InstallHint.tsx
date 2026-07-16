'use client';
import { useEffect, useState } from 'react';

// The (non-standard) event Chromium fires when the app is installable.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep our own affordance instead of the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  // Android/Chrome path: a real one-tap install button.
  if (deferred) {
    return (
      <div className="install-hint">
        <button
          type="button"
          className="install-btn"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice.catch(() => undefined);
            setDeferred(null);
          }}
        >
          📲 Instalează pe telefon
        </button>
      </div>
    );
  }

  // iOS / desktop / event not fired: manual instructions.
  return (
    <details className="install-hint">
      <summary>📲 Pune-l pe telefon</summary>
      <ul>
        <li>
          <strong>iPhone:</strong> Safari → butonul Share → „Add to Home Screen /
          Adaugă pe ecranul principal”.
        </li>
        <li>
          <strong>Android (Chrome):</strong> meniul ⋮ → „Instalează aplicația”.
        </li>
        <li>
          <strong>Samsung Internet:</strong> meniul ≡ (jos dreapta) → „Adăugare
          pagină la” → „Ecran de pornire”.
        </li>
      </ul>
    </details>
  );
}
