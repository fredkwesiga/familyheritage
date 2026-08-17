import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import {
  approximateDateSchema,
  EMPTY_DATE,
  livingStatusSchema,
  normalizeDate,
  type Member,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { applyApiError } from '@/features/auth/form-errors';
import { ApproximateDateInput } from './approximate-date-input';

/**
 * One schema for both adding and editing.
 *
 * It mirrors the API contract but keeps every text field as a string rather
 * than string-or-null, because that is what an <input> actually holds. The
 * conversion to null happens once, on submit.
 */
const formSchema = z
  .object({
    givenName: z.string().trim().max(80),
    familyName: z.string().trim().max(80),
    otherNames: z.string().trim().max(80),
    maidenName: z.string().trim().max(80),
    gender: z.string().trim().max(40),
    livingStatus: livingStatusSchema,
    birth: approximateDateSchema,
    birthPlace: z.string().trim().max(160),
    occupation: z.string().trim().max(120),
    biography: z.string().trim().max(20000),
    notes: z.string().trim().max(5000),
  })
  .refine((value) => Boolean(value.givenName || value.familyName), {
    message: 'Enter at least a first or last name',
    path: ['givenName'],
  });

export type MemberFormValues = z.infer<typeof formSchema>;

const emptyValues: MemberFormValues = {
  givenName: '',
  familyName: '',
  otherNames: '',
  maidenName: '',
  gender: '',
  livingStatus: 'UNKNOWN',
  birth: EMPTY_DATE,
  birthPlace: '',
  occupation: '',
  biography: '',
  notes: '',
};

export function memberToFormValues(member: Member): MemberFormValues {
  return {
    givenName: member.givenName ?? '',
    familyName: member.familyName ?? '',
    otherNames: member.otherNames ?? '',
    maidenName: member.maidenName ?? '',
    gender: member.gender ?? '',
    livingStatus: member.livingStatus,
    birth: member.birth ?? EMPTY_DATE,
    birthPlace: member.birthPlace ?? '',
    occupation: member.occupation ?? '',
    biography: member.biography ?? '',
    notes: member.notes ?? '',
  };
}

/** Empty strings become null so the API stores absence, not "". */
export const orNull = (value: string): string | null => value.trim() || null;

interface MemberFormProps {
  defaultValues?: MemberFormValues;
  submitLabel: string;
  /** Living status is set here on create, but changed through its own flow after. */
  showLivingStatus: boolean;
  onSubmit: (values: MemberFormValues) => Promise<void>;
  onCancel: () => void;
}

export function MemberForm({
  defaultValues,
  submitLabel,
  showLivingStatus,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [formError, setFormError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? emptyValues,
  });

  const submit = handleSubmit(async (values) => {
    setFormError('');
    try {
      // Collapse a half-filled date ("exact" chosen but no day picked) to
      // "nothing recorded", rather than storing a meaningless fragment.
      await onSubmit({ ...values, birth: normalizeDate(values.birth) });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <FormMessage>{formError}</FormMessage>

      <section className="space-y-5">
        <h2 className="font-serif text-lg tracking-tight">Name</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="First name" htmlFor="givenName" error={errors.givenName?.message}>
            <Input id="givenName" autoFocus aria-invalid={Boolean(errors.givenName)} {...register('givenName')} />
          </FormField>

          <FormField label="Last name" htmlFor="familyName" error={errors.familyName?.message}>
            <Input id="familyName" aria-invalid={Boolean(errors.familyName)} {...register('familyName')} />
          </FormField>

          <FormField
            label="Other names"
            htmlFor="otherNames"
            error={errors.otherNames?.message}
            hint="Middle names, a clan name, a name they were known by."
          >
            <Input id="otherNames" {...register('otherNames')} />
          </FormField>

          <FormField
            label="Name at birth"
            htmlFor="maidenName"
            error={errors.maidenName?.message}
            hint="If their family name changed on marriage."
          >
            <Input id="maidenName" {...register('maidenName')} />
          </FormField>
        </div>
      </section>

      <section className="space-y-5 border-t border-border/60 pt-8">
        <h2 className="font-serif text-lg tracking-tight">Life</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            control={control}
            name="birth"
            render={({ field }) => (
              <ApproximateDateInput
                label="Born"
                idPrefix="birth"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          <FormField label="Place of birth" htmlFor="birthPlace" error={errors.birthPlace?.message}>
            <Input id="birthPlace" placeholder="Masaka, Uganda" {...register('birthPlace')} />
          </FormField>

          <FormField
            label="Gender"
            htmlFor="gender"
            error={errors.gender?.message}
            hint="Free text — historical records are inconsistent."
          >
            <Input id="gender" {...register('gender')} />
          </FormField>

          <FormField label="Occupation" htmlFor="occupation" error={errors.occupation?.message}>
            <Input id="occupation" placeholder="Coffee farmer" {...register('occupation')} />
          </FormField>

          {showLivingStatus && (
            <FormField
              label="Are they living?"
              htmlFor="livingStatus"
              error={errors.livingStatus?.message}
              hint="Choose “Not known” if you're unsure — it is better than a guess."
            >
              <Select id="livingStatus" {...register('livingStatus')}>
                <option value="UNKNOWN">Not known</option>
                <option value="LIVING">Living</option>
                <option value="DECEASED">Has passed away</option>
              </Select>
            </FormField>
          )}
        </div>
      </section>

      <section className="space-y-5 border-t border-border/60 pt-8">
        <h2 className="font-serif text-lg tracking-tight">Their story</h2>

        <FormField
          label="Biography"
          htmlFor="biography"
          error={errors.biography?.message}
          hint="Anything worth remembering. This can be a sentence or a page."
        >
          <Textarea id="biography" rows={6} {...register('biography')} />
        </FormField>

        <FormField
          label="Private notes"
          htmlFor="notes"
          error={errors.notes?.message}
          hint="For research notes and things you are unsure of."
        >
          <Textarea id="notes" rows={3} {...register('notes')} />
        </FormField>
      </section>

      <div className="flex items-center gap-3 border-t border-border/60 pt-6">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}