import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EMPTY_DATE } from '@fh/shared';
import { useCurrentFamily } from '@/features/families/family-context';
import { StoryForm, type StoryFormValues } from '@/features/stories/story-form';
import { useCreateStory } from '@/features/stories/use-stories';

export function StoryNewPage() {
  const { family } = useCurrentFamily();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createStory = useCreateStory(family.id);

  // Arriving from a member's profile pre-tags them, so the writer never has to
  // answer a question they already answered by clicking where they clicked.
  const preTagged = searchParams.get('member');

  const handleSubmit = async (values: StoryFormValues) => {
    const story = await createStory.mutateAsync({
      title: values.title,
      body: values.body,
      eventDate: values.eventDate,
      place: values.place.trim() || undefined,
      visibility: values.visibility,
      memberIds: values.memberIds,
    });
    void navigate(`/f/${family.id}/stories/${story.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        to={`/f/${family.id}/stories`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Stories
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Write a story</h1>
        <p className="text-muted-foreground text-pretty">
          It does not have to be finished, or tidy, or long. Anything written down survives; what
          stays in someone's head does not.
        </p>
      </header>

      <StoryForm
        initialValues={{
          title: '',
          body: '',
          eventDate: EMPTY_DATE,
          place: '',
          visibility: 'FAMILY',
          memberIds: preTagged ? [preTagged] : [],
        }}
        submitLabel="Save the story"
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/f/${family.id}/stories`)}
      />
    </div>
  );
}