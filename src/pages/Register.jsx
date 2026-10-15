import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Layout';
import { BackButton, Button, Field, ImageUpload, Input, Select, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { DEFAULT_ADDRESS, PUROKS, purokLabel } from '../lib/geography';
import { combineName, isEmail, isPhone, normalizePhone, passwordProblem } from '../lib/validation';
const empty = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirm: '',
  phone: '',
  address: DEFAULT_ADDRESS,
  purok: '',
};
export default function Register() {
  const { registerResident } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const validate = () => {
    const e = {};
    if (f.firstName.trim().length < 2) e.firstName = 'Enter your first name.';
    if (f.lastName.trim().length < 2) e.lastName = 'Enter your last name.';
    if (!f.email.trim()) e.email = 'Email address is required.';
    else if (!isEmail(f.email)) e.email = 'Enter a valid email address.';
    const pw = passwordProblem(f.password);
    if (pw) e.password = pw;
    if (!f.confirm) e.confirm = 'Please confirm your password.';
    else if (f.confirm !== f.password) e.confirm = 'Passwords do not match.';
    if (!f.phone.trim()) e.phone = 'Phone number is required.';
    else if (!isPhone(f.phone)) e.phone = 'Use a PH mobile number, e.g. 09171234567 or +639171234567.';
    if (f.address.trim().length < 5) e.address = 'Enter your complete address.';
    if (!f.purok) e.purok = 'Select your Purok.';
    if (!f.proof) e.proof = 'Upload a proof of residency image.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Please correct the highlighted fields.');
      return;
    }
    setLoading(true);
    const email = f.email.trim().toLowerCase();
    const name = combineName(f.firstName, f.lastName);
    try {
      const code = await registerResident({
        email,
        password: f.password,
        name,
        phone: normalizePhone(f.phone),
        address: f.address.trim(),
        purok: f.purok,
        proofImage: f.proof,
      });
      setDone({ email, code });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your application.');
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
      <main className="flex flex-1 justify-center px-4 py-6">
        <div className="eco-animate-in w-full max-w-2xl rounded-3xl border border-gray-200/80 bg-white/90 p-6 shadow-xl shadow-green-900/5 ring-1 ring-black/5 backdrop-blur sm:p-8">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Application submitted</h1>
              <div className="mx-auto mt-4 max-w-lg rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                  Your unique application tracking ID
                </p>
                <p className="mt-2 break-all font-mono text-lg font-bold tracking-wide text-green-800 sm:text-xl">
                  {done.code}
                </p>
                <p className="mt-2 text-xs text-green-700">
                  Save this Resident ID. Enter it on the homepage to track your application status.
                </p>
              </div>
              <p className="mt-3 text-gray-600">
                Your application is{' '}
                <span className="font-semibold text-amber-700">pending administrator approval</span>.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Your application is linked to <span className="font-medium">{done.email}</span>. Sign in after the
                barangay approves your proof of residency.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                <Link to="/#track">
                  <Button>Track my application</Button>
                </Link>
                <Link to="/">
                  <Button variant="outline">Back to home</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Resident registration</h1>
              <p className="mt-1 text-sm text-gray-500">
                Your account will be reviewed by the barangay before you can submit waste reports.
              </p>
              <form onSubmit={submit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="r-first" required error={errors.firstName}>
                  <Input
                    id="r-first"
                    autoComplete="given-name"
                    value={f.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    invalid={!!errors.firstName}
                    placeholder="Juan"
                  />
                </Field>
                <Field label="Last name" htmlFor="r-last" required error={errors.lastName}>
                  <Input
                    id="r-last"
                    autoComplete="family-name"
                    value={f.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    invalid={!!errors.lastName}
                    placeholder="Dela Cruz"
                  />
                </Field>
                <Field label="Email address" htmlFor="r-email" required error={errors.email}>
                  <Input
                    id="r-email"
                    type="email"
                    autoComplete="email"
                    value={f.email}
                    onChange={(e) => set('email', e.target.value)}
                    invalid={!!errors.email}
                  />
                </Field>
                <Field label="Phone number" htmlFor="r-phone" required error={errors.phone}>
                  <Input
                    id="r-phone"
                    type="tel"
                    autoComplete="tel"
                    value={f.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    invalid={!!errors.phone}
                    placeholder="09171234567"
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="r-pw"
                  required
                  error={errors.password}
                  hint="8+ characters with uppercase, lowercase and a number."
                >
                  <div className="relative">
                    <Input
                      id="r-pw"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={f.password}
                      onChange={(e) => set('password', e.target.value)}
                      invalid={!!errors.password}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm password" htmlFor="r-cpw" required error={errors.confirm}>
                  <div className="relative">
                    <Input
                      id="r-cpw"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={f.confirm}
                      onChange={(e) => set('confirm', e.target.value)}
                      invalid={!!errors.confirm}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field
                  label="Address"
                  htmlFor="r-addr"
                  hint="Set automatically for this barangay — pick your Purok below."
                  className="sm:col-span-2"
                >
                  <Input
                    id="r-addr"
                    value={f.address}
                    readOnly
                    aria-readonly
                    className="bg-gray-50 text-gray-600"
                  />
                </Field>
                <Field label="Purok" htmlFor="r-purok" required error={errors.purok}>
                  <Select
                    id="r-purok"
                    value={f.purok}
                    onChange={(e) => set('purok', e.target.value)}
                    invalid={!!errors.purok}
                  >
                    <option value="">Select Purok</option>
                    {PUROKS.map((p) => (
                      <option key={p} value={p}>
                        {purokLabel(p)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Proof of residency <span className="text-red-600">*</span>
                  </p>
                  <ImageUpload
                    id="r-proof"
                    value={f.proof}
                    onChange={(v) => set('proof', v)}
                    error={errors.proof}
                    label="Upload barangay certificate, ID or utility bill"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Already registered?{' '}
                    <Link to="/login" className="font-medium text-green-700 hover:underline">
                      Sign in
                    </Link>
                  </p>
                  <Button type="submit" loading={loading}>
                    {loading ? 'Submitting…' : 'Submit application'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
