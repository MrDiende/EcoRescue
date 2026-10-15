import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Inbox,
  Loader2,
  Pencil,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { fileToCompressedDataUrl } from '../lib/storage';
import { imageProblem } from '../lib/validation';
import { PUROKS } from '../lib/geography';
/** Plain text of a ReactNode (used to turn an icon-only button's label into its tooltip / accessible name). */
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(node.props.children);
  return '';
}
const squareSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
const variants = {
  primary:
    'bg-gradient-to-b from-green-500 to-green-600 text-white shadow-sm shadow-green-600/25 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800',
  secondary:
    'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/15 hover:bg-green-100 active:bg-green-200',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-600/25 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800',
  warning:
    'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-500/25 hover:from-amber-500 hover:to-amber-600 active:to-amber-700',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200',
  outline:
    'border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100',
};
const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[0.95rem] gap-2',
};
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  title,
  'aria-label': ariaLabel,
  ...rest
}) {
  const label = textOf(children).replace(/\s+/g, ' ').trim();
  // Buttons with a text label show the label (plus icon). Only buttons with no text are icon-only squares.
  const iconOnly = !label;
  const glyph = loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      title={title ?? (iconOnly ? label || undefined : undefined)}
      aria-label={ariaLabel ?? (iconOnly ? label || undefined : undefined)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap active:scale-[0.98] [&_svg]:h-4 [&_svg]:w-4',
        variants[variant],
        iconOnly ? cn(squareSizes[size], 'p-0') : sizes[size],
        className,
      )}
      {...rest}
    >
      {glyph}
      {iconOnly ? null : children}
    </button>
  );
}
/** Icon-only back button: returns to the previous page, or to the homepage when there is no history. */
export function BackButton({ fallback = '/', label = 'Back', className }) {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = window.history.state?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
    </button>
  );
}
/** Square, icon-only edit button. Shows an "Edit" tooltip and keeps an accessible label. */
export function EditButton({ label = 'Edit', onClick, variant = 'ghost', className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-green-50 hover:text-green-700 active:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1',
        variant === 'outline' && 'h-10 w-10 border border-gray-200 bg-white shadow-xs',
        className,
      )}
    >
      <Pencil className="h-4 w-4" aria-hidden />
    </button>
  );
}
/* ---------------- Layout primitives ---------------- */
export function Card({ className, children, title, action, bodyClass }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-gray-200/80 bg-white shadow-sm shadow-gray-900/[0.03] transition-shadow hover:shadow-md hover:shadow-gray-900/5',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn('p-5 sm:p-6', bodyClass)}>{children}</div>
    </section>
  );
}
export function PageHeader({ title, subtitle, actions, crumbs }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav
            aria-label="Breadcrumb"
            className="mb-1 flex flex-wrap items-center gap-1 text-xs text-gray-500"
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-green-700 hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-gray-700">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-xl font-bold tracking-tight text-gray-900 sm:text-[1.7rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
const tones = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  gray: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};
export function Badge({ tone = 'gray', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
const STATUS = {
  pending: ['amber', 'Pending'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Rejected'],
  in_progress: ['blue', 'In Progress'],
  resolved: ['green', 'Resolved'],
  scheduled: ['purple', 'Scheduled'],
  completed: ['green', 'Completed'],
  missed: ['red', 'Missed'],
  cancelled: ['gray', 'Cancelled'],
  active: ['green', 'Active'],
  inactive: ['gray', 'Inactive'],
  available: ['blue', 'Available'],
  maintenance: ['amber', 'Maintenance'],
  open: ['red', 'Open'],
  acknowledged: ['amber', 'Acknowledged'],
  closed: ['green', 'Closed'],
  on_route: ['green', 'On Route'],
  offline: ['gray', 'Offline'],
};
export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] ?? ['gray', status];
  return (
    <Badge tone={tone}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          {
            green: 'bg-green-600',
            blue: 'bg-blue-600',
            amber: 'bg-amber-500',
            red: 'bg-red-600',
            gray: 'bg-gray-500',
            purple: 'bg-purple-600',
          }[tone],
        )}
        aria-hidden
      />
      {label}
    </Badge>
  );
}
export function StatCard({ label, value, icon, tone = 'green', hint, to }) {
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1.5 font-display text-[1.6rem] font-bold leading-none text-gray-900">{value}</p>
        {hint && <p className="mt-1.5 truncate text-xs text-gray-400">{hint}</p>}
      </div>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:h-5 [&_svg]:w-5',
          tones[tone],
        )}
      >
        {icon}
      </div>
    </div>
  );
  const cls =
    'block rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm shadow-gray-900/[0.03] sm:p-5';
  return to ? (
    <Link
      to={to}
      className={cn(
        cls,
        'group transition-all hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md hover:shadow-green-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400 ring-1 ring-inset ring-gray-200/70">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Avatar({ name, className }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 text-xs font-bold text-green-800 ring-1 ring-inset ring-green-600/10',
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
export function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 text-sm sm:grid sm:grid-cols-3 sm:gap-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-gray-500">
        {label}
      </dt>
      <dd className="col-span-2 break-words text-gray-900">{children}</dd>
    </div>
  );
}
export function TableWrap({ children }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="min-w-full divide-y divide-gray-100 text-sm">{children}</table>
    </div>
  );
}
export const th =
  'px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-gray-400 sm:px-5 whitespace-nowrap';
export const td = 'px-4 py-3.5 align-top text-gray-700 sm:px-5';
export function Tabs({ tabs, value, onChange }) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100/80 p-1 ring-1 ring-inset ring-gray-200/60"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
            value === t.id
              ? 'bg-white text-green-800 shadow-sm shadow-gray-900/5'
              : 'text-gray-500 hover:text-gray-900',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-xs',
                value === t.id ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
/* ---------------- Form controls ---------------- */
const control =
  'block w-full rounded-xl border bg-white px-3.5 text-sm text-gray-900 shadow-xs transition placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/15 disabled:bg-gray-50 disabled:text-gray-500';
export function Field({ label, error, required, hint, children, htmlFor, className }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
        {label}{' '}
        {required && (
          <span className="text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
export function Input({ invalid, className, ...rest }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        'h-10',
        invalid ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-green-500',
        className,
      )}
      {...rest}
    />
  );
}
export function Select({ invalid, className, children, ...rest }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        'h-10 pr-8',
        invalid ? 'border-red-400' : 'border-gray-300 focus:border-green-500',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
/** Password input with a built-in show/hide eye toggle. */
export function PasswordInput({ invalid, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} invalid={invalid} className="pr-10" {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
export function Textarea({ invalid, className, ...rest }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        'py-2',
        invalid ? 'border-red-400' : 'border-gray-300 focus:border-green-500',
        className,
      )}
      rows={3}
      {...rest}
    />
  );
}
export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
export function PurokPicker({ value, onChange, invalid, options = PUROKS, allOption = false }) {
  const toggle = (p) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  const allOn = options.length > 0 && options.every((p) => value.includes(p));
  return (
    <div className={cn('flex flex-wrap gap-2 rounded-lg', invalid && 'ring-2 ring-red-300 p-1')}>
      {allOption && (
        <button
          type="button"
          aria-pressed={allOn}
          onClick={() => onChange(allOn ? [] : [...options])}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
            allOn
              ? 'border-green-700 bg-green-700 text-white'
              : 'border-green-600 bg-green-50 text-green-800 hover:bg-green-100',
          )}
        >
          {allOn ? '✓ ' : ''}All Puroks
        </button>
      )}
      {options.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
              on
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-green-400',
            )}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
export function ImageUpload({ value, onChange, error, id, label = 'Upload image' }) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState();
  const ref = useRef(null);
  const handle = async (file) => {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) {
      setLocalErr(problem);
      return;
    }
    setLocalErr(undefined);
    setBusy(true);
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Could not process image.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  const err = localErr ?? error;
  return (
    <div>
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Uploaded preview"
            className="h-36 max-w-full rounded-lg border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-green-500 hover:border-green-400 hover:bg-green-50/50',
            err ? 'border-red-300' : 'border-gray-300',
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          ) : (
            <ImagePlus className="h-6 w-6 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700">{busy ? 'Processing…' : label}</span>
          <span className="text-xs text-gray-500">JPG, PNG or WEBP · max 5 MB</span>
          <input
            ref={ref}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handle(e.target.files?.[0])}
          />
        </label>
      )}
      {err && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const titleId = useId();
  const panel = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = panel.current?.querySelector(
        'input:not([type=hidden]),select,textarea,button:not([data-close])',
      );
      (el ?? panel.current)?.focus();
    }, 20);
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  const w = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  // Rendered in a portal on <body> so it always covers the full viewport, even when an
  // ancestor (e.g. the animated <main>) has a CSS transform that would otherwise trap `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'eco-animate-in relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl shadow-gray-900/20 outline-none ring-1 ring-black/5 pb-[env(safe-area-inset-bottom)] sm:max-h-[92vh] sm:rounded-2xl sm:pb-0',
          w,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="font-display text-base font-bold text-gray-900">
            {title}
          </h2>
          <button
            data-close
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onCancel,
  reasonLabel,
  reasonPlaceholder,
}) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState();
  useEffect(() => {
    if (open) {
      setReason('');
      setErr(undefined);
    }
  }, [open]);
  const submit = () => {
    if (reasonLabel && reason.trim().length < 5) {
      setErr(`${reasonLabel} is required (at least 5 characters).`);
      return;
    }
    onConfirm(reason.trim());
  };
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            tone === 'danger'
              ? 'bg-red-50 text-red-600'
              : tone === 'warning'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-green-50 text-green-600',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="text-sm text-gray-600">{message}</div>
      </div>
      {reasonLabel && (
        <Field label={reasonLabel} required error={err} htmlFor="confirm-reason" className="mt-4">
          <Textarea
            id="confirm-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            invalid={!!err}
          />
        </Field>
      )}
    </Modal>
  );
}
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, message) => {
    const id = Date.now() + Math.random();
    setItems((s) => [
      ...s.filter((item) => item.kind !== kind || item.message !== message),
      { id, kind, message },
    ].slice(-3));
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
  }, []);
  const api = useRef({ success: (m) => push('success', m), error: (m) => push('error', m) }).current;
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg',
              t.kind === 'success' ? 'border-green-200' : 'border-red-200',
            )}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            )}
            <span className="flex-1 text-gray-800">{t.message}</span>
            <button
              onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
export function Alert({ tone = 'amber', title, children, icon, role = 'note' }) {
  return (
    <div className={cn('flex gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset', tones[tone])} role={role}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}
export function ProgressBar({ value, className }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
