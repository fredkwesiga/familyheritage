import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createFamilyInputSchema, type CreateFamilyInput } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { applyApiError } from '@/features/auth/form-errors';
import { useCreateFamily } from '@/features/families/use-families';

export function CreateFamilyPage() {
  const navigate = useNavigate();
  const createFamily = useCreateFamily();
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateFamilyInput>({
    resolver: zodResolver(createFamilyInputSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      const family = await createFamily.mutateAsync(values);
            // Straight into the guided start rather than an empty overview: the
      // moment after naming a family is when someone is most willing to add to it.
      void navigate(`/f/${family.id}/start`, { replace: true });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <Link
        to="/families"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Name your family</h1>
        <p className="text-muted-foreground">
          You can change this later, and invite the rest of the family whenever you're ready.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormMessage>{formError}</FormMessage>

        <FormField
          label="Family name"
          htmlFor="name"
          error={errors.name?.message}
          hint="Most people use a surname, like “The Kwesiga Family”."
        >
          <Input
            id="name"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : 'name-hint'}
            {...register('name')}
          />
        </FormField>

        <FormField
          label="A short description"
          htmlFor="description"
          error={errors.description?.message}
          hint="Optional. A line about where the family is from, or what ties it together."
        >
          <Textarea
            id="description"
            rows={3}
            placeholder="From Masaka to Kampala, five generations."
            aria-invalid={Boolean(errors.description)}
            {...register('description')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          Create family
        </Button>
      </form>
    </div>
  );
}