import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import type { RelationshipAnswer } from '@fh/shared';

/**
 * Builds the sentence.
 *
 * Kept as a function rather than assembled inline in JSX because the phrasing
 * has real edge cases - in-laws need the connecting person, "no link" must not
 * read as an error, and the wording changes depending on whether the reader is
 * one of the two people.
 */
function sentence(answer: RelationshipAnswer, fromIsYou: boolean): string {
  const subject = answer.to.displayName;
  const possessive = fromIsYou ? 'your' : `${answer.from.displayName}'s`;
  const object = fromIsYou ? 'you' : answer.from.displayName;

  switch (answer.kind) {
    case 'SELF':
      return `${subject} is the same person.`;

    case 'UNRELATED':
      // Deliberately "not yet recorded" rather than "not related". The absence
      // of a link in the tree is a gap in the record, not a fact about a family.
      return `No link between ${object} and ${subject} has been recorded yet.`;

    case 'IN_LAW':
      return answer.via
        ? `${subject} is related to ${object} by marriage, through ${answer.via.displayName}.`
        : `${subject} is related to ${object} by marriage.`;

    case 'STEP_PARENT':
    case 'STEP_CHILD':
      return answer.via
        ? `${subject} is ${possessive} ${answer.label}, through ${answer.via.displayName}.`
        : `${subject} is ${possessive} ${answer.label}.`;

    default:
      return `${subject} is ${possessive} ${answer.label}.`;
  }
}

export function RelationshipAnswerCard({
  answer,
  fromIsYou,
  familyId,
}: {
  answer: RelationshipAnswer;
  fromIsYou: boolean;
  familyId: string;
}) {
  if (answer.kind === 'SELF') return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <p className="font-serif text-xl leading-snug tracking-tight text-pretty">
        {sentence(answer, fromIsYou)}
      </p>

      {answer.commonAncestors.length > 0 && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {/* "Both descend from" is true for every blood relationship. Saying
              "you share grandparents" would be wrong for an aunt, whose parent
              is the reader's grandparent. */}
          Both descend from{' '}
          {answer.commonAncestors.map((ancestor, index) => (
            <span key={ancestor.id}>
              {index > 0 && (index === answer.commonAncestors.length - 1 ? ' and ' : ', ')}
              <Link
                to={`/f/${familyId}/members/${ancestor.id}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {ancestor.displayName}
              </Link>
            </span>
          ))}
          .
        </p>
      )}

      {answer.viaAdoption && (
        <p className="text-sm text-muted-foreground">
          This connection runs through an adoption.
        </p>
      )}

      {/* Shown on purpose. The whole point of this feature is that the answer is
          calculated rather than guessed, and exposing the computed form is the
          most direct way to say so. */}
      {answer.kind !== 'UNRELATED' && (
        <p className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <GitBranch aria-hidden className="size-3.5" />
          Calculated from the family tree
          <code className="font-mono">{answer.canonical}</code>
        </p>
      )}
    </div>
  );
}