import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useHealth } from './use-health';

export function ConnectionStatus() {
  const { data, isPending, isError, error } = useHealth();

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>Live check of the API and its dependencies.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="animate-spin" />
            Contacting the API…
          </p>
        )}

        {isError && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Cannot reach the API.</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Unknown error.'} Is the API running on
                port 3000?
              </p>
            </div>
          </div>
        )}

        {data && (
          <>
            <StatusRow
              label={`${data.service} ${data.version}`}
              status={data.status}
              detail={`${data.environment} · up ${data.uptimeSeconds}s`}
            />
            {data.dependencies.map((dependency) => (
              <StatusRow
                key={dependency.name}
                label={dependency.name}
                status={dependency.status}
                detail={
                  dependency.message ??
                  (dependency.latencyMs !== undefined ? `${dependency.latencyMs} ms` : undefined)
                }
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'ok' | 'degraded';
  detail?: string;
}) {
  const isOk = status === 'ok';
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm">
        {isOk ? (
          <CheckCircle2 aria-hidden className="text-primary" />
        ) : (
          <AlertTriangle aria-hidden className="text-destructive" />
        )}
        <span className="font-medium">{label}</span>
      </span>
      <span className="flex items-center gap-3 text-sm text-muted-foreground">
        {detail && <span className="tabular-nums">{detail}</span>}
        <span className={cn('font-medium', isOk ? 'text-primary' : 'text-destructive')}>
          {status}
        </span>
      </span>
    </div>
  );
}
