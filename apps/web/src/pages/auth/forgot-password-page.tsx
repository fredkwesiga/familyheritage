import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { emailOnlyInputSchema, type EmailOnlyInput } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { applyApiError } from '@/features/auth/form-errors';
import { useRequestPasswordReset } from '@/features/auth/use-auth';

export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyInput>({
    resolver: zodResolver(emailOnlyInputSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await requestReset.mutateAsync(values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  if (sentTo) {
    return (
      <div className="space-y-6">
        <MailCheck aria-hidden className="size-8 text-primary" />
        <header className="space-y-2">
          <h1 className="font-serif text-3xl tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">
            If an account exists for <span className="text-foreground">{sentTo}</span>, a reset
            link is on its way.
          </p>
        </header>
        <p className="border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <Link to="/login" className="underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Reset your password</h1>
        <p className="text-muted-foreground">
          Tell us your email and we'll send a link to set a new one.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormMessage>{formError}</FormMessage>

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          Send reset link
        </Button>
      </form>

      <p className="border-t border-border/60 pt-6 text-sm text-muted-foreground">
        <Link to="/login" className="underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}