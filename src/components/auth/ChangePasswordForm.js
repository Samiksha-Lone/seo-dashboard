'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/ui/PasswordInput';

export default function ChangePasswordForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          router.replace('/login');
          return;
        }
        if (active) setUser(payload.data.user);
      })
      .catch(() => {
        if (active) setError('Unable to verify your session.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to change your password.');
        return;
      }
      router.replace(user?.role === 'ADMIN' ? '/' : '/portal');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-slate-600">Checking your session…</p>;

  return (
    <form onSubmit={submit} className="space-y-5">
      {user?.mustChangePassword && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your administrator provided a temporary password. Change it before continuing.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <label className="block text-sm font-medium text-slate-700">
        Current password
        <PasswordInput required autoComplete="current-password" maxLength={1024} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        New password (at least 12 characters)
        <PasswordInput required autoComplete="new-password" minLength={12} maxLength={1024} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirm new password
        <PasswordInput required autoComplete="new-password" minLength={12} maxLength={1024} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </label>
      <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
