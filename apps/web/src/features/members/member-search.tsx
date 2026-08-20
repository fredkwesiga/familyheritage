import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { formatLifeDates, MATCH_LABELS, MIN_SEARCH_LENGTH } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentFamily } from '@/features/families/family-context';
import { MemberAvatar } from './member-avatar';
import { useMemberSearch } from './use-member-search';

/**
 * Search across a family's names.
 *
 * Results appear beneath the field rather than in a floating panel: on a phone
 * a dropdown over the page is fiddly to dismiss, and a family scanning results
 * usually wants to read several rather than pick the first.
 */
export function MemberSearch() {
  const { family } = useCurrentFamily();
  const [query, setQuery] = useState('');
  const { data, isFetching, isTyping, enabled } = useMemberSearch(family.id, query);

  const results = data?.results ?? [];
  const showEmpty = enabled && !isFetching && !isTyping && results.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          aria-label="Search relatives by name"
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear the search"
            onClick={() => setQuery('')}
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
          >
            <X aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      {isFetching && !isTyping && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="animate-spin" />
          Looking…
        </p>
      )}

      {showEmpty && (
        <p className="text-sm text-muted-foreground text-pretty">
          Nobody found for “{data?.query}”. Spelling does not have to be exact — try a shorter
          part of the name.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {results.map(({ member, matchedOn }) => {
            const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);
            // Explains why someone appeared: a search for a name at birth can
            // return a person listed under a completely different surname.
            const why = MATCH_LABELS[matchedOn];

            return (
              <li key={member.id}>
                <Link
                  to={`/f/${family.id}/members/${member.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MemberAvatar
                    memberId={member.id}
                    displayName={member.displayName}
                    livingStatus={member.livingStatus}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif">{member.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[lifeDates, why].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH && (
        <p className="text-sm text-muted-foreground">Keep typing…</p>
      )}
    </div>
  );
}