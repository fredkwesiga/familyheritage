import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCurrentFamily } from '@/features/families/family-context';
import {
  StoryForm,
  storyToFormValues,
  type StoryFormValues,
} from '@/features/stories/story-form';
import { useStory, useUpdateStory } from '@/features/stories/use-stories';

export function StoryEditPage() {
  const { family } = useCurrentFamily();
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { data: story, isPending } = useStory(family.id, storyId);
  const updateStory = useUpdateStory(family.id, storyId ?? '');

  if (isPending || !story) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 aria-label="Loading" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (values: StoryFormValues) => {
    await updateStory.mutateAsync({
      title: values.title,
      body: values.body,
      eventDate: values.eventDate,
      place: values.place.trim() || null,
      visibility: values.visibility,
      memberIds: values.memberIds,
    });
    void navigate(`/f/${family.id}/stories/${story.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        to={`/f/${family.id}/stories/${story.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {story.title}
      </Link>

      <h1 className="font-serif text-3xl tracking-tight">Edit the story</h1>

      <StoryForm
        initialValues={storyToFormValues(story)}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/f/${family.id}/stories/${story.id}`)}
      />
    </div>
  );
}