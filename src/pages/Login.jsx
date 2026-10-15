import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Logo } from '../components/Layout';
import { Alert, BackButton, Button, Field, Input, useToast } from '../components/ui';
import { homePath, useAuth } from '../lib/auth';
import { isEmail } from '../lib/validation';
export default function Login() {
  const { user, login, authError } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [applicationAlert, setApplicationAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  if (user && !loading) return <Navigate to={homePath(user.role)} replace />;
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = 'Email address is required.';
    else if (!isEmail(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    setFormError('');
    setApplicationAlert(null);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const res = await login(email, password);
      if (!res.ok) {
        if (res.status === 'pending' || res.status === 'rejected') {
          setApplicationAlert({ status: res.status, message: res.error });
          return;
        }
        setFormError(res.error || 'Could not sign in. Please check your credentials and try again.');
        return;
      }
      toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      if (res.warning) toast.error(res.warning);
      navigate(homePath(res.user.role), { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error && err.message ? err.message : 'Could not sign in. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-green-50 via-white to-gray-50">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <BackButton />
        <Link
          to="/"
          aria-label="EcoRescue homepage"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        >
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="eco-animate-in w-full max-w-md rounded-3xl border border-gray-200/80 bg-white/90 p-6 shadow-xl shadow-green-900/5 ring-1 ring-black/5 backdrop-blur sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">Access your EcoRescue portal.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {(formError || authError) && <Alert tone="red">{formError || authError}</Alert>}
            {applicationAlert && (
              <Alert
                tone={applicationAlert.status === 'pending' ? 'amber' : 'red'}
                title={
                  applicationAlert.status === 'pending'
                    ? 'Application pending approval'
                    : 'Application rejected'
                }
                role="alert"
              >
                {applicationAlert.message}
              </Alert>
            )}
            <Field label="Email address" htmlFor="email" required error={errors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={!!errors.email}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" htmlFor="password" required error={errors.password}>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={!!errors.password}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" className="w-full" loading={loading} icon={<LogIn className="h-4 w-4" />}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            New resident?{' '}
            <Link to="/register" className="font-medium text-green-700 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
