import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ONBOARDING_STEPS = ['you', 'parents', 'siblings', 'children'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * The frame every step shares.
 *
 * One question at a time, in a serif large enough to read as a question rather
 * than a form label. The continue button always says what happens next, and
 * every step can be skipped - a person who does not know their grandmother's
 * name should not be stuck on a screen demanding it.
 */
export function OnboardingStepFrame({
  step,
  question,
  hint,
  children,
  onContinue,
  continueLabel,
  canContinue = true,
}: {
  step: OnboardingStep;
  question: string;
  hint?: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel: string;
  canContinue?: boolean;
}) {
  const index = ONBOARDING_STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <nav aria-label="Progress" className="flex items-center gap-2">
        {ONBOARDING_STEPS.map((current, position) => (
          <span
            key={current}
            aria-current={position === index ? 'step' : undefined}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              position <= index ? 'bg-primary' : 'bg-secondary',
            )}
          />
        ))}
        <span className="sr-only">
          Step {index + 1} of {ONBOARDING_STEPS.length}
        </span>
      </nav>

      <header className="space-y-3">
        <h1 className="font-serif text-3xl leading-tight tracking-tight text-balance">
          {question}
        </h1>
        {hint && (
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{hint}</p>
        )}
      </header>

      <div className="space-y-6">{children}</div>

      <div className="flex items-center gap-3 border-t border-border/60 pt-6">
        <Button size="lg" onClick={onContinue} disabled={!canContinue}>
          {continueLabel}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** A person added during onboarding, shown so progress feels real. */
export function AddedList({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {names.map((name) => (
        <li
          key={name}
          className="rounded-full bg-secondary px-3 py-1.5 font-serif text-sm text-secondary-foreground"
        >
          {name}
        </li>
      ))}
    </ul>
  );
}