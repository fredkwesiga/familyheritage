import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, passwordSchema } from '@fh/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { applyApiError } from '@/features/auth/form-errors';
import { useConfirmPasswordReset } from '@/features/auth/use-auth';

/**
 * The confirmation field is client-only: the API has no use for it, and sending
 * it would mean the server validating a field whose only purpose is catching a
 * typo before the user locks themselves out.
 */
const formSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const confirmReset = useConfirmPasswordReset();
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);

  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await confirmReset.mutateAsync({ token, password: values.password });
      setDone(true);
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  if (!token) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl tracking-tight">That link is incomplete</h1>
        <p className="text-muted-foreground">Request a new reset link and try again.</p>
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <CheckCircle2 aria-hidden className="size-8 text-primary" />
        <header className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight">Password updated</h1>
          <p className="text-muted-foreground">
            For safety, you've been signed out everywhere. Sign in with your new password.
          </p>
        </header>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Choose a new password</h1>
        <p className="text-muted-foreground">
          This also signs you out on every other device.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormMessage>{formError}</FormMessage>

        <FormField
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...register('password')}
          />
        </FormField>

        <FormField
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            {...register('confirmPassword')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  );
}