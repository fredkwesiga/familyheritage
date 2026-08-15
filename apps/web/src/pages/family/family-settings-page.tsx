import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { applyApiError } from '@/features/auth/form-errors';
import { useCurrentFamily } from '@/features/families/family-context';
import { useUpdateFamily } from '@/features/families/use-families';

const detailsSchema = z.object({
  name: z.string().trim().min(1, 'Give your family a name').max(120),
  description: z.string().trim().max(500),
});
type DetailsValues = z.infer<typeof detailsSchema>;

export function FamilySettingsPage() {
  const { family, can } = useCurrentFamily();
  const updateFamily = useUpdateFamily(family.id);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const editable = can(Permission.FAMILY_UPDATE);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: family.name, description: family.description ?? '' },
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await updateFamily.mutateAsync({
        name: values.name,
        description: values.description.trim() || null,
      });
      setSaved(true);
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const toggle = async (field: 'hideLivingFromViewers' | 'aiEnabled', value: boolean) => {
    setFormError('');
    try {
      await updateFamily.mutateAsync({ [field]: value });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  };

  return (
    <div className="max-w-2xl space-y-12">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Settings</h1>
        {!editable && (
          <p className="text-muted-foreground">
            Your role lets you read these settings. An admin can change them.
          </p>
        )}
      </header>

      <FormMessage>{formError}</FormMessage>

      <section className="space-y-5">
        <h2 className="font-serif text-xl tracking-tight">Details</h2>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormField label="Family name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              disabled={!editable}
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </FormField>

          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea
              id="description"
              rows={3}
              disabled={!editable}
              aria-invalid={Boolean(errors.description)}
              {...register('description')}
            />
          </FormField>

          {editable && (
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
                Save changes
              </Button>
              {saved && (
                <span role="status" className="text-sm text-primary">
                  Saved
                </span>
              )}
            </div>
          )}
        </form>
      </section>

      <section className="space-y-5 border-t border-border/60 pt-10">
        <h2 className="font-serif text-xl tracking-tight">Privacy</h2>

        <SettingRow
          icon={<Lock aria-hidden className="size-4" />}
          id="hide-living"
          title="Hide living relatives from viewers"
          description={
            'People with the Viewer role will see the names of living relatives, but not their ' +
            'dates, biography or notes. Recording family history means recording other living ' +
            "people's details, and they have not agreed to it."
          }
          checked={family.hideLivingFromViewers}
          disabled={!editable || updateFamily.isPending}
          onChange={(value) => void toggle('hideLivingFromViewers', value)}
        />
      </section>

      <section className="space-y-5 border-t border-border/60 pt-10">
        <h2 className="font-serif text-xl tracking-tight">AI assistance</h2>

        <SettingRow
          icon={<Sparkles aria-hidden className="size-4" />}
          id="ai-enabled"
          title="Allow AI help with writing stories"
          description={
            'Off by default. When on, rough notes you choose to send can be turned into a ' +
            'structured draft that you review before anything is saved. Photographs are never ' +
            'sent. Everything else in the product works exactly the same either way.'
          }
          checked={family.aiEnabled}
          disabled={!editable || updateFamily.isPending}
          onChange={(value) => void toggle('aiEnabled', value)}
        />
      </section>
    </div>
  );
}

function SettingRow({
  icon,
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <Label htmlFor={id} className="flex items-center gap-2 text-base">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </Label>
        <p id={`${id}-description`} className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={`${id}-description`}
      />
    </div>
  );
}