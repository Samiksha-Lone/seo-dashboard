import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export const metadata = {
  title: 'Change Password',
  description: 'Update your EDGELINK SEO account password.',
};

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Account security</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Change your password</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600">Use a unique password with at least 12 characters.</p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
