import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Two fields and a button.
 *
 * Everything else a person can have - dates, places, occupation, a photograph -
 * is deliberately absent here. During onboarding the only goal is to get a few
 * real names into the tree; asking for a birth date at this moment is how you
 * turn a two-minute task into an afternoon someone never starts.
 */
export function QuickAddPerson({
  label,
  placeholderFirst,
  placeholderLast,
  busy,
  onAdd,
}: {
  label: string;
  placeholderFirst?: string;
  placeholderLast?: string;
  busy?: boolean;
  onAdd: (person: { givenName: string; familyName: string }) => Promise<void>;
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');

  const submit = async () => {
    if (!givenName.trim() && !familyName.trim()) return;
    await onAdd({ givenName: givenName.trim(), familyName: familyName.trim() });
    setGivenName('');
    setFamilyName('');
    // Focus returns to the first field, so adding four siblings is four
    // rounds of type-type-Enter rather than a hunt for the cursor each time.
    firstRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/90">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          ref={firstRef}
          value={givenName}
          onChange={(event) => setGivenName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
          placeholder={placeholderFirst ?? 'First name'}
          aria-label={`${label} — first name`}
          className="min-w-32 flex-1"
        />
        <Input
          value={familyName}
          onChange={(event) => setFamilyName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
          placeholder={placeholderLast ?? 'Last name'}
          aria-label={`${label} — last name`}
          className="min-w-32 flex-1"
        />
        <Button
          variant="outline"
          onClick={() => void submit()}
          disabled={busy || (!givenName.trim() && !familyName.trim())}
        >
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          Add
        </Button>
      </div>
    </div>
  );
}