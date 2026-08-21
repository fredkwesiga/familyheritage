import { useEffect, useState } from 'react';
import { EMPTY_DATE, type ApproximateDate, type DateQualifier } from '@fh/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Mode = 'unknown' | 'exact' | 'approximate';

/**
 * How the qualifiers are actually explained.
 *
 * "ABOUT / BEFORE / AFTER / RANGE" is database vocabulary. A person recording
 * their grandmother's birth needs to know which one means what, and an example
 * answers that faster than a definition does.
 */
interface QualifierOption {
  value: DateQualifier;
  label: string;
  example: string;
}

const QUALIFIERS: [QualifierOption, ...QualifierOption[]] = [
  { value: 'ABOUT', label: 'Around then', example: '1936, or the early 1940s' },
  { value: 'BEFORE', label: 'Before', example: '1945, or the war' },
  { value: 'AFTER', label: 'After', example: '1950, or independence' },
  { value: 'RANGE', label: 'Somewhere between', example: '1935 and 1940' },
];

/** Which mode a stored value represents. */
function modeOf(value: ApproximateDate): Mode {
  if (value.date) return 'exact';
  if (value.text) return 'approximate';
  return 'unknown';
}

export function ApproximateDateInput({
  label,
  idPrefix,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  value: ApproximateDate;
  onChange: (value: ApproximateDate) => void;
}) {
  /**
   * Mode is held here rather than derived from the value on every render.
   *
   * Deriving it looked tidier and was wrong: choosing "an exact date" produces
   * a value with a qualifier and no day yet, which derivation reads back as
   * "roughly" - so the panel the user asked for vanished the instant they asked
   * for it. The mode is what the person chose; the value is what they have
   * typed so far, and those are genuinely two different things.
   */
  const [mode, setMode] = useState<Mode>(() => modeOf(value));

  // Only follow the value when it is replaced from outside - loading a member
  // for editing, or a form reset. Typing must never move the mode.
  useEffect(() => {
    setMode((current) => {
      const incoming = modeOf(value);
      if (current === 'unknown' && incoming !== 'unknown') return incoming;
      if (current !== 'unknown' && incoming === 'unknown') return current;
      return current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.date, value.text]);

  const chooseMode = (next: Mode) => {
    setMode(next);
    if (next === 'unknown') onChange(EMPTY_DATE);
    if (next === 'exact') onChange({ date: null, qualifier: 'EXACT', text: null });
    if (next === 'approximate') onChange({ date: null, qualifier: 'ABOUT', text: '' });
  };

  const qualifier: QualifierOption =
    QUALIFIERS.find((entry) => entry.value === value.qualifier) ?? QUALIFIERS[0];

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-foreground/90">{label}</legend>

      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        <ModeButton
          active={mode === 'unknown'}
          onClick={() => chooseMode('unknown')}
          label="Not known"
        />
        <ModeButton
          active={mode === 'exact'}
          onClick={() => chooseMode('exact')}
          label="Exact date"
        />
        <ModeButton
          active={mode === 'approximate'}
          onClick={() => chooseMode('approximate')}
          label="Roughly"
        />
      </div>

      {mode === 'exact' && (
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={value.date ?? ''}
          aria-label={`${label} — exact date`}
          onChange={(event) =>
            onChange({
              // The only path that ever writes to `date`. Everything else keeps
              // it null, which is what stops "about 1936" being stored as
              // 1 January 1936.
              date: event.target.value || null,
              qualifier: 'EXACT',
              text: null,
            })
          }
        />
      )}

      {mode === 'approximate' && (
        <div className="space-y-2">
          <Select
            id={`${idPrefix}-qualifier`}
            value={value.qualifier ?? 'ABOUT'}
            aria-label={`${label} — how approximate`}
            onChange={(event) =>
              onChange({
                date: null,
                qualifier: event.target.value as DateQualifier,
                text: value.text ?? '',
              })
            }
          >
            {QUALIFIERS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>

          <Input
            id={`${idPrefix}-text`}
            value={value.text ?? ''}
            aria-label={`${label} — when, roughly`}
            placeholder={qualifier.example}
            onChange={(event) =>
              onChange({
                date: null,
                qualifier: value.qualifier ?? 'ABOUT',
                text: event.target.value,
              })
            }
          />

          {/* Shows the sentence that will appear on the profile, so nobody has
              to guess how their answer will read. */}
          <p className="text-xs text-muted-foreground">
            {value.text
              ? `Will show as “${qualifier.label.toLowerCase()} ${value.text}”.`
              : `For example: ${qualifier.example}.`}
          </p>
        </div>
      )}

      {mode === 'unknown' && (
        <p className="text-xs text-muted-foreground text-pretty">
          Leaving this blank is a real answer. A guessed date is worse than none.
        </p>
      )}
    </fieldset>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
      )}
    >
      {label}
    </button>
  );
}