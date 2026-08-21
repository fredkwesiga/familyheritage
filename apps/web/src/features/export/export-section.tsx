import { useState } from 'react';
import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import { Permission } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';

type Format = 'json' | 'gedcom';

/**
 * "Your data is yours" made operable.
 *
 * The download is deliberately unglamorous and deliberately prominent. A family
 * is being asked to trust several generations of their history to software that
 * may not exist in five years, and the only honest answer to that is a file
 * they already have on their own machine.
 *
 * It is also, in practice, the backup. On a free-tier database with a few hours
 * of restore, a family that has downloaded this is better protected than one
 * relying on the hosting.
 */
export function ExportSection() {
  const { family, can } = useCurrentFamily();
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState('');

  if (!can(Permission.FAMILY_EXPORT)) return null;

  const download = async (format: Format) => {
    setBusy(format);
    setError('');

    try {
      // Not through apiRequest: this returns a file, not a validated JSON
      // envelope, and the response has to become a Blob rather than be parsed.
      const response = await fetch(`/api/v1/families/${family.id}/export/${format}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('The download could not be prepared.');

      const blob = await response.blob();
      // The server names the file; the browser only follows.
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `family-export.${format === 'json' ? 'json' : 'ged'}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The download failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-5 border-t border-border/60 pt-10">
      <h2 className="font-serif text-xl tracking-tight">Take a copy</h2>

      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-2">
          <Download aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Everything recorded here — every person, every link between them, every story — in a
            file you keep. Worth doing occasionally regardless of what happens to this software.
          </p>
        </div>

        <FormMessage>{error}</FormMessage>

        <div className="grid gap-4 sm:grid-cols-2">
          <ExportOption
            icon={<FileText aria-hidden className="size-4" />}
            title="GEDCOM"
            description="The standard genealogy format. Ancestry, MyHeritage, Gramps and most other software can open it."
            busy={busy === 'gedcom'}
            onDownload={() => void download('gedcom')}
          />

          <ExportOption
            icon={<FileJson aria-hidden className="size-4" />}
            title="Complete data"
            description="Every field exactly as stored, including stories and where each was written from. Nothing left out."
            busy={busy === 'json'}
            onDownload={() => void download('json')}
          />
        </div>

        {/* Said here as well as inside the file, because a limitation only
            discovered years later is not one anyone was warned about. */}
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Photographs are linked rather than included, and those links depend on the image
          storage staying active. If the pictures matter, save them separately.
        </p>
      </div>
    </section>
  );
}

function ExportOption({
  icon,
  title,
  description,
  busy,
  onDownload,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={onDownload}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />}
        Download
      </Button>
    </div>
  );
}