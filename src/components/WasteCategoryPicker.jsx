import { Leaf, Recycle, Trash2, Biohazard } from 'lucide-react';
import { cn } from '../utils/cn';
export const CATEGORIES = [
  {
    id: 'biodegradable',
    label: 'Biodegradable',
    desc: 'Food scraps, leaves, yard waste',
    icon: <Leaf className="h-5 w-5" />,
    color: 'text-green-700 bg-green-50',
  },
  {
    id: 'recyclable',
    label: 'Recyclable',
    desc: 'Plastic bottles, paper, cans, glass',
    icon: <Recycle className="h-5 w-5" />,
    color: 'text-blue-700 bg-blue-50',
  },
  {
    id: 'residual',
    label: 'Residual',
    desc: 'Sachets, diapers, mixed trash',
    icon: <Trash2 className="h-5 w-5" />,
    color: 'text-gray-700 bg-gray-100',
  },
  {
    id: 'special',
    label: 'Special Waste',
    desc: 'Batteries, bulbs, chemicals, e-waste',
    icon: <Biohazard className="h-5 w-5" />,
    color: 'text-red-700 bg-red-50',
  },
];
export const categoryLabel = (c) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
export function CategoryTag({ category }) {
  const c = CATEGORIES.find((x) => x.id === category);
  if (!c) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        c.color,
      )}
    >
      {c.label}
    </span>
  );
}
export default function WasteCategoryPicker({ value, onChange, error }) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-gray-700">
        Waste category <span className="text-red-600">*</span>
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CATEGORIES.map((c) => {
          const on = value === c.id;
          return (
            <label
              key={c.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-green-500',
                on
                  ? 'border-green-600 bg-green-50/60 ring-1 ring-green-600'
                  : 'border-gray-200 hover:border-green-300',
                error && !value && 'border-red-300',
              )}
            >
              <input
                type="radio"
                name="waste-category"
                value={c.id}
                checked={on}
                onChange={() => onChange(c.id)}
                className="sr-only"
              />
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', c.color)}>
                {c.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">{c.label}</span>
                <span className="block text-xs text-gray-500">{c.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
