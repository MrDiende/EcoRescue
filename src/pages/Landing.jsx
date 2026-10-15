import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hourglass,
  LogIn,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Navigation,
  Phone,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCog,
  UserPlus,
  Users,
  X,
  Clock,
  Leaf,
} from 'lucide-react';
import { Logo } from '../components/Layout';
import { Alert, Button, Input, StatusBadge } from '../components/ui';
import { homePath, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/time';
import { BARANGAY_NAME, BARANGAY_SHORT, MUNICIPALITY, POSTAL_CODE } from '../lib/geography';
const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How It Works' },
  { id: 'track', label: 'Track' },
  { id: 'contact', label: 'Contact' },
];
const FEATURES = [
  {
    icon: Calendar,
    title: 'Collection Schedules',
    desc: 'Know exactly when the truck arrives in your Purok, with Monday & Thursday regular pickups.',
  },
  {
    icon: FileText,
    title: 'Waste Reporting',
    desc: 'Report uncollected garbage, illegal dumping or hazardous waste with photos.',
  },
  {
    icon: Navigation,
    title: 'Live GPS Tracking',
    desc: 'Verified residents and admins follow trucks live on OpenStreetMap once a collector starts a route.',
  },
  {
    icon: Users,
    title: 'Resident Management',
    desc: 'Verify proof of residency and keep resident records organized.',
  },
  {
    icon: UserCog,
    title: 'Collector Management',
    desc: 'Assign collectors to routes, Puroks and vehicles in a few clicks.',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    desc: 'Send targeted updates to everyone, residents, collectors or specific Puroks.',
  },
  {
    icon: Route,
    title: 'Route Management',
    desc: 'Plan ordered stops from the barangay hall through every Purok.',
  },
  {
    icon: ClipboardCheck,
    title: 'Operational Reports',
    desc: 'Collectors flag breakdowns, obstructions and full trucks instantly.',
  },
];
const STEPS = [
  { title: 'Register', desc: 'Residents create an account and upload proof of residency.' },
  {
    title: 'Track your application',
    desc: 'Check your registration status anytime using your Resident ID — no sign-in needed.',
  },
  { title: 'Verification', desc: 'The barangay admin reviews and approves the registration.' },
  { title: 'Stay informed', desc: 'Residents view schedules, track trucks and submit waste reports.' },
  { title: 'Collect', desc: 'Collectors run assigned routes and file operational reports.' },
  { title: 'Monitor', desc: 'Admins monitor activity and manage the entire system.' },
];
export default function Landing() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('home');
  const heroSrc = `${import.meta.env.BASE_URL}assets/hero.jpg`;
  const go = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <button
            onClick={() => go('home')}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            aria-label="EcoRescue home"
          >
            <Logo />
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${active === s.id ? 'text-green-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <button
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative overflow-hidden bg-gradient-to-b from-green-50 via-green-50/40 to-white"
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-green-200/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-600/15 backdrop-blur">
              <Leaf className="h-3.5 w-3.5" /> {BARANGAY_NAME} Waste Management
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-[3.25rem]">
              Smarter barangay waste collection for a{' '}
              <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                cleaner community
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-gray-600">
              EcoRescue connects residents, garbage collectors and barangay administrators — view schedules,
              report waste problems and track collection trucks in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to={homePath(user.role)} tabIndex={-1}>
                  <Button size="lg" icon={<ArrowRight className="h-5 w-5" />}>
                    Open my portal
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register" tabIndex={-1}>
                    <Button size="lg" icon={<UserPlus className="h-5 w-5" />}>
                      Register as Resident
                    </Button>
                  </Link>
                  <Link to="/login" tabIndex={-1}>
                    <Button size="lg" variant="outline" icon={<LogIn className="h-5 w-5" />}>
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Mon & Thu, 7:30 AM pickups
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Purok 1–8 covered
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Works on any device
              </span>
            </div>
          </div>
          <div className="relative">
            <div
              className="absolute inset-6 rounded-[2rem] bg-gradient-to-tr from-green-300/40 to-emerald-200/40 blur-2xl"
              aria-hidden
            />
            <img
              src={heroSrc}
              alt="A barangay garbage collector and houses beside the EcoRescue dashboard on a laptop and phone with a live map"
              className="relative w-full rounded-3xl object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-lg shadow-gray-900/10 ring-1 ring-black/5 backdrop-blur sm:left-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white">
                <Navigation className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Live truck tracking</p>
                <p className="text-xs text-gray-500">Next stop: Purok 3 · {BARANGAY_SHORT}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-600">About EcoRescue</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">One system for the whole barangay</h2>
            <p className="mt-4 text-gray-600">
              EcoRescue helps {BARANGAY_NAME} coordinate garbage collection under the spirit of RA 9003
              (Ecological Solid Waste Management Act). Residents always know when to bring out segregated
              waste, collectors follow clear routes, and administrators see what is happening across every
              Purok.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              { icon: Users, t: 'Residents', d: 'View schedules, report problems, and get notified.' },
              { icon: Truck, t: 'Collectors', d: 'Follow assigned routes and report field issues.' },
              { icon: ShieldCheck, t: 'Administrators', d: 'Verify residents and manage operations.' },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-gray-200 p-5">
                <x.icon className="h-6 w-6 text-green-600" />
                <p className="mt-3 font-semibold text-gray-900">{x.t}</p>
                <p className="mt-1 text-sm text-gray-600">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-600">Features</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              Everything needed for organized collection
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-600">How it works</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Simple steps for everyone</h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-xl border border-gray-200 bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 font-semibold text-gray-900">{s.title}</p>
                <p className="mt-1 text-sm text-gray-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Track */}
      <section id="track" className="scroll-mt-16 bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-600">
              Track your application
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Check your registration status
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              Registered already? Enter the Resident ID from your registration confirmation to see if your
              application is pending, approved or rejected — no sign-in needed.
            </p>
          </div>
          <TrackSection />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-16 bg-green-700 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Contact the Barangay Office</h2>
            <p className="mt-3 max-w-lg text-green-100">
              For account concerns, collection issues or special pickup requests, reach out to the Barangay
              Environmental Office.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="rounded-xl bg-white/10 p-4">
              <MapPin className="h-5 w-5" />
              <p className="mt-2 font-semibold">Barangay Hall</p>
              <p className="text-sm text-green-100">
                {BARANGAY_NAME}, {MUNICIPALITY} {POSTAL_CODE}
              </p>
            </li>
            <li className="rounded-xl bg-white/10 p-4">
              <Phone className="h-5 w-5" />
              <p className="mt-2 font-semibold">Hotline</p>
              <p className="text-sm text-green-100">
                (044) 000-0000 (sample — replace with barangay hotline)
              </p>
            </li>
            <li className="rounded-xl bg-white/10 p-4">
              <Mail className="h-5 w-5" />
              <p className="mt-2 font-semibold">Email</p>
              <p className="text-sm text-green-100">brgy.msgarcia@example.com (sample)</p>
            </li>
            <li className="rounded-xl bg-white/10 p-4">
              <Clock className="h-5 w-5" />
              <p className="mt-2 font-semibold">Office hours</p>
              <p className="text-sm text-green-100">Mon–Fri, 8:00 AM – 5:00 PM</p>
            </li>
          </ul>
        </div>
      </section>

      <footer className="bg-gray-900 py-10 text-gray-400">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3">
          <div>
            <Logo light />
            <p className="mt-3 text-sm">
              Barangay waste management system connecting residents, collectors and administrators.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-sm font-semibold text-white">Navigate</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button onClick={() => go(s.id)} className="hover:text-white">
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="text-sm">
            <p className="font-semibold text-white">Barangay Office</p>
            <p className="mt-3 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {BARANGAY_NAME}, {MUNICIPALITY} {POSTAL_CODE}
            </p>
            <p className="mt-2 flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Mon–Fri, 8:00 AM – 5:00 PM
            </p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-7xl border-t border-gray-800 px-4 pt-6 text-xs sm:px-6">
          © {new Date().getFullYear()} EcoRescue — {BARANGAY_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
function TrackSection() {
  const [id, setId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const q = id.trim().toUpperCase();
    if (!q) {
      setError('Please enter your Resident ID.');
      setResult(null);
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { data, error: requestError } = await supabase.rpc('track_resident_application', {
        p_code: q,
      });
      if (requestError) throw new Error(requestError.message);
      const application = data?.[0];
      if (!application) {
        setResult({ kind: 'notfound' });
        return;
      }
      setResult({
        kind: 'found',
        name: application.name,
        code: application.code,
        status: application.status ?? 'pending',
        createdAt: application.created_at,
        reviewedAt: application.reviewed_at,
        rejectionReason: application.rejection_reason,
      });
    } catch {
      setError('Could not check the application right now. Please try again later.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <form onSubmit={submit} noValidate>
        <label htmlFor="track-id" className="mb-1 block text-sm font-medium text-gray-700">
          Resident ID
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              id="track-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              invalid={!!error}
              placeholder="R- followed by your 32-character ID"
              autoComplete="off"
            />
          </div>
          <Button type="submit" loading={loading} icon={<Search className="h-4 w-4" />} className="w-full sm:w-auto">
            Track status
          </Button>
        </div>
        <p
          className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-gray-500'}`}
          role={error ? 'alert' : undefined}
        >
          {error ?? 'You received this ID after registering.'}
        </p>
      </form>

      {result?.kind === 'notfound' && (
        <div className="mt-4">
          <Alert tone="amber" icon={<ShieldAlert className="h-5 w-5" />} title="No application found">
            No resident application matches that ID. Please check the ID from your registration confirmation,
            or register if you haven't yet.
          </Alert>
        </div>
      )}

      {result?.kind === 'found' && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{result.name}</p>
              <p className="text-xs text-gray-500">
                Resident ID: {result.code} · Submitted {formatDate(result.createdAt)}
              </p>
            </div>
            <StatusBadge status={result.status} />
          </div>
          <div className="mt-3 text-sm">
            {result.status === 'pending' && (
              <p className="flex items-start gap-2 text-amber-800">
                <Hourglass className="mt-0.5 h-4 w-4 shrink-0" /> Your application is waiting for barangay
                review. You will be able to sign in once it is approved.
              </p>
            )}
            {result.status === 'approved' && (
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-green-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Your residency is verified
                  {result.reviewedAt ? ` (approved ${formatDate(result.reviewedAt)})` : ''}. You can now sign
                  in.
                </p>
                <Link to="/login" tabIndex={-1}>
                  <Button icon={<LogIn className="h-4 w-4" />}>Sign in now</Button>
                </Link>
              </div>
            )}
            {result.status === 'rejected' && (
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-red-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> Your application was not approved
                  {result.reviewedAt ? ` (${formatDate(result.reviewedAt)})` : ''}.
                  {result.rejectionReason ? ` Reason: ${result.rejectionReason}` : ''}
                </p>
                <Link to="/register" tabIndex={-1}>
                  <Button variant="outline" icon={<UserPlus className="h-4 w-4" />}>
                    Register again
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
