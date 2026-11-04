'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out.');
      router.replace('/login');
      router.refresh();
    } catch {
      setBusy(false);
      setError('Sign out failed. Please try again.');
    }
  }

  return (
    <div className="text-right">
      <Button type="button" variant="ghost" size="sm" onClick={logout} disabled={busy} className="text-slate-600 hover:text-slate-900">
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
      {error && <p role="alert" className="absolute right-4 top-14 max-w-xs rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
