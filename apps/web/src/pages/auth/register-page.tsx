import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, registerInputSchema, type RegisterInput } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { applyApiError } from '@/features/auth/form-errors';
import { useRegister } from '@/features/auth/use-auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const signUp = useRegister();
  const [formError, setFormError] = useState('');

  // An invitation carries the address it was sent to, so the person never has
  // to notice that it has to match.
  const invitedEmail = searchParams.get('email') ?? '';
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { email: invitedEmail, password: '', name: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await signUp.mutateAsync(values);
      void navigate(returnTo, { replace: true });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight text-balance">
          Begin your family's record
        </h1>
        <p className="text-muted-foreground">
          One account is enough to start. You can invite the rest of the family later.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormMessage>{formError}</FormMessage>

        <FormField
          label="Your name"
          htmlFor="name"
          error={errors.name?.message}
          hint="Optional — this is how relatives will see you."
        >
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...register('password')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="border-t border-border/60 pt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}