import { useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  EMPTY_DATE,
  normalizeDate,
  Permission,
  STORY_PROMPTS,
  STORY_VISIBILITY_LABELS,
  type ApproximateDate,
  type MemberSummary,
  type Story,
  type StoryVisibility,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentFamily } from '@/features/families/family-context';
import { ApproximateDateInput } from '@/features/members/approximate-date-input';
import { useMembers } from '@/features/members/use-members';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface StoryFormValues {
  title: string;
  body: string;
  eventDate: ApproximateDate;
  place: string;
  visibility: StoryVisibility;
  memberIds: string[];
}

export function storyToFormValues(story: Story): StoryFormValues {
  return {
    title: story.title,
    body: story.body,
    eventDate: story.eventDate ?? EMPTY_DATE,
    place: story.place ?? '',
    visibility: story.visibility,
    memberIds: story.subjects.map((subject) => subject.id),
  };
}

/**
 * Writing a story.
 *
 * A full page, not a dialog. Long-form writing in a modal is cramped, easy to
 * dismiss by accident, and signals "fill in this field" rather than "tell us
 * what you remember" - and getting anyone to write anything is the hardest part
 * of this whole product.
 */
export function StoryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: StoryFormValues;
  submitLabel: string;
  onSubmit: (values: StoryFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { family, can } = useCurrentFamily();
  const { data: memberData } = useMembers(family.id);

  const [values, setValues] = useState<StoryFormValues>(
    initialValues ?? {
      title: '',
      body: '',
      eventDate: EMPTY_DATE,
      place: '',
      visibility: 'FAMILY',
      memberIds: [],
    },
  );
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * STORY_PROMPTS.length),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const members = memberData?.members ?? [];
  const canUseAdminOnly = can(Permission.SENSITIVE_VIEW);

  const selected = useMemo(
    () => members.filter((member) => values.memberIds.includes(member.id)),
    [members, values.memberIds],
  );

  const set = <K extends keyof StoryFormValues>(key: K, value: StoryFormValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const toggleMember = (member: MemberSummary) =>
    setValues((previous) => ({
      ...previous,
      memberIds: previous.memberIds.includes(member.id)
        ? previous.memberIds.filter((id) => id !== member.id)
        : [...previous.memberIds, member.id],
    }));

  const submit = async () => {
    setError('');
    if (!values.title.trim()) return setError('Give the story a title.');
    if (!values.body.trim()) return setError('A story needs something in it.');

    setBusy(true);
    try {
      await onSubmit({ ...values, eventDate: normalizeDate(values.eventDate) });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the story.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <FormMessage>{error}</FormMessage>

      {/* The blank page is what stops family history being written. A prompt
          turns "write your family's history", which nobody can answer, into a
          question almost anyone can. */}
      {!values.body && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-dashed border-border bg-card/60 p-5">
          <p className="font-serif text-lg leading-snug text-pretty">
            {STORY_PROMPTS[promptIndex]}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Another question"
            onClick={() => setPromptIndex((index) => (index + 1) % STORY_PROMPTS.length)}
          >
            <RefreshCw aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <FormField label="Title" htmlFor="story-title">
        <Input
          id="story-title"
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder="Peter's journey to Kampala"
          autoFocus
        />
      </FormField>

      <FormField label="The story" htmlFor="story-body">
        <Textarea
          id="story-body"
          value={values.body}
          onChange={(event) => set('body', event.target.value)}
          rows={16}
          className="font-serif text-lg leading-relaxed"
          placeholder="Write as much or as little as you like. Nobody is marking it."
        />
      </FormField>

      <section className="space-y-3">
        <h2 className="font-serif text-lg tracking-tight">Who is it about?</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add some relatives first and you can tag them here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const chosen = values.memberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => toggleMember(member)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chosen
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                    )}
                  >
                    {member.displayName}
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground">
                It will appear on {selected.length === 1 ? 'their profile' : 'each of their profiles'}.
              </p>
            )}
          </>
        )}
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <ApproximateDateInput
          label="When did this happen?"
          idPrefix="story-date"
          value={values.eventDate}
          onChange={(value) => set('eventDate', value)}
        />

        <FormField label="Where?" htmlFor="story-place">
          <Input
            id="story-place"
            value={values.place}
            onChange={(event) => set('place', event.target.value)}
            placeholder="Masaka, Uganda"
          />
        </FormField>
      </section>

      {canUseAdminOnly && (
        <FormField
          label="Who can read it?"
          htmlFor="story-visibility"
          hint={STORY_VISIBILITY_LABELS[values.visibility].hint}
        >
          <Select
            id="story-visibility"
            value={values.visibility}
            onChange={(event) => set('visibility', event.target.value as StoryVisibility)}
          >
            {Object.entries(STORY_VISIBILITY_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <div className="flex items-center gap-3 border-t border-border/60 pt-6">
        <Button size="lg" onClick={() => void submit()} disabled={busy}>
          {busy && <Loader2 aria-hidden className="animate-spin" />}
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}