'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/ui/PasswordInput';

const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function ClientAccountManager({ clientId, account }) {
  const router = useRouter();
  const [email, setEmail] = useState(account?.email || '');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function send(url, method, body) {
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to update the client account.');
        return false;
      }
      setMessage('Client account updated.');
      setTemporaryPassword('');
      router.refresh();
      return true;
    } catch {
      setError('Could not reach the server. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function provision(event) {
    event.preventDefault();
    const success = await send(`/api/clients/${encodeURIComponent(clientId)}/account`, 'POST', {
      action: 'provision',
      email,
      temporaryPassword,
    });
    if (success) setEmail(email.trim().toLowerCase());
  }

  async function updateAccount(event) {
    event.preventDefault();
    await send(`/api/clients/${encodeURIComponent(clientId)}/account`, 'PATCH', { email });
  }

  async function resetPassword(event) {
    event.preventDefault();
    await send(`/api/clients/${encodeURIComponent(clientId)}/account`, 'POST', {
      action: 'resetPassword',
      temporaryPassword,
    });
  }

  async function toggleActive() {
    await send(`/api/clients/${encodeURIComponent(clientId)}/account`, 'PATCH', {
      isActive: !account.isActive,
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Client portal account</h2>
          <p className="mt-1 text-sm text-slate-500">Login credentials are managed here; no email invitation is sent.</p>
        </div>
        {account && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {account.isActive ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      {!account ? (
        <form onSubmit={provision} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Login email
            <input required type="email" autoComplete="off" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Temporary password (12+ characters)
            <PasswordInput required autoComplete="new-password" minLength={12} maxLength={1024} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} className={inputClass} />
          </label>
          <div className="sm:col-span-2">
            <button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Provisioning…' : 'Create portal account'}
            </button>
            <p className="mt-2 text-xs text-slate-500">The client is required to change this temporary password after signing in. Share it through a secure channel.</p>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-5">
          <form onSubmit={updateAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-700">
              Login email
              <input required type="email" autoComplete="off" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
            </label>
            <button disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Update email</button>
          </form>
          <form onSubmit={resetPassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-700">
              New temporary password
              <PasswordInput required autoComplete="new-password" minLength={12} maxLength={1024} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} className={inputClass} />
            </label>
            <button disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Reset password</button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {account.mustChangePassword ? 'Password change required at next login.' : 'Password is set; it is never displayed here.'}
            </p>
            <button type="button" disabled={saving} onClick={toggleActive} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${account.isActive ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
              {account.isActive ? 'Deactivate account' : 'Activate account'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
