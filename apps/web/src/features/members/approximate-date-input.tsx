import { EMPTY_DATE, type ApproximateDate, type DateQualifier } from '@fh/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Mode = 'unknown' | 'exact' | 'approximate';

function modeOf(value: ApproximateDate | null | undefined): Mode {
  if (!value) return 'unknown';
  if (value.date) return 'exact';
  if (value.text || value.qualifier) return 'approximate';
  return 'unknown';
}

/**
 * The date control that makes the whole approximate-date model usable.
 *
 * Three modes, because those are the three things a family actually knows:
 * the exact day, roughly when, or nothing. A plain date picker forces the third
 * case to be answered as the first, which is how "about 1936" becomes
 * "1 January 1936" and quietly becomes a fact.
 *
 * Only "exact" ever writes to `date`. That is the invariant the whole date
 * model rests on.
 */
export function ApproximateDateInput({
  value,
  onChange,
  idPrefix,
  label,
}: {
  value: ApproximateDate | null | undefined;
  onChange: (value: ApproximateDate) => void;
  idPrefix: string;
  label: string;
}) {
  const mode = modeOf(value);

  const setMode = (next: Mode) => {
    if (next === 'unknown') onChange(EMPTY_DATE);
    else if (next === 'exact') onChange({ date: null, qualifier: 'EXACT', text: null });
    else onChange({ date: null, qualifier: 'ABOUT', text: '' });
  };

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium leading-none text-foreground/90">{label}</legend>

      <div role="radiogroup" aria-label={`How well is ${label} known?`} className="flex gap-1.5">
        {(
          [
            ['unknown', 'Not known'],
            ['exact', 'Exact date'],
            ['approximate', 'Roughly'],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {mode === 'exact' && (
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={value?.date ?? ''}
          onChange={(event) =>
            onChange({ date: event.target.value || null, qualifier: 'EXACT', text: null })
          }
        />
      )}

      {mode === 'approximate' && (
        <div className="flex gap-2">
          <div className="w-32">
            <Select
              aria-label={`How approximate is ${label}?`}
              value={value?.qualifier ?? 'ABOUT'}
              onChange={(event) =>
                onChange({
                  date: null,
                  qualifier: event.target.value as DateQualifier,
                  text: value?.text ?? '',
                })
              }
            >
              <option value="ABOUT">About</option>
              <option value="BEFORE">Before</option>
              <option value="AFTER">After</option>
              <option value="RANGE">Between</option>
            </Select>
          </div>
          <Input
            id={`${idPrefix}-text`}
            placeholder="1936, or “the war years”"
            value={value?.text ?? ''}
            onChange={(event) =>
              onChange({
                date: null,
                qualifier: value?.qualifier ?? 'ABOUT',
                text: event.target.value,
              })
            }
          />
        </div>
      )}

      {mode === 'unknown' && (
        <p className="text-xs text-muted-foreground">
          Leave this if nobody remembers. It can be filled in later.
        </p>
      )}
    </fieldset>
  );
}