import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Login',
  description: 'Sign in to your EDGELINK SEO dashboard or client portal.',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">E</div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-indigo-600">EDGELINK SEO</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Use your administrator or client portal account.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
