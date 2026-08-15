/* eslint-disable no-console */
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Seeds the Kwesiga fixture family.
 *
 * This is not decorative sample data. It is a deliberate test corpus for the
 * relationship engine in Phase 7, and it contains every case that breaks naive
 * family-tree code:
 *
 *   - remarriage        Peter marries Josephine, then Esther after her death
 *   - half-siblings     Moses shares only Peter with John and Grace
 *   - adoption          Anna is adoptive daughter of Grace and Samuel
 *   - step-parentage    Esther is step-mother to John and Grace
 *   - unknown parent    Robert has a recorded mother and no recorded father
 *   - unknown status    Daniel has no death record and is not assumed living
 *   - approximate dates Yusuf and Daniel have "about" years, not exact dates
 *   - no photographs    every member exists without one, by design
 *   - four generations  plus a fifth living child
 *
 * Idempotent: it deletes the fixture family (cascading to everything it owns)
 * and rebuilds it. Run it as often as you like.
 */

const prisma = new PrismaClient();

// Deterministic IDs so tests and documentation can reference people directly.
const uid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FAMILY_ID = uid(1000);
const USER_ID = uid(2000);

/** Members are numbered; M(3) is Peter throughout. */
const M = (n: number): string => uid(n);

/**
 * Dates.
 *
 * INVARIANT: the DATE column means "we know this exact day". Anything less
 * certain leaves it null and lives in the qualifier + text fields. That keeps
 * "about 1936" from silently becoming "1 January 1936" in a timeline.
 *
 * The 'T00:00:00.000Z' suffix is not optional - without it, a bare date string
 * is parsed in local time and can land on the previous day.
 */
const exact = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface SeedMember {
  n: number;
  givenName: string;
  familyName: string;
  maidenName?: string;
  gender: string;
  livingStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN';
  birth?: { date?: string; qualifier: 'EXACT' | 'ABOUT'; text?: string; place?: string };
  death?: { date?: string; qualifier: 'EXACT' | 'ABOUT'; text?: string; place?: string };
  occupation?: string;
  biography?: string;
  notes?: string;
}

const MEMBERS: SeedMember[] = [
  // ---- Generation 1 ------------------------------------------------------
  {
    n: 1,
    givenName: 'Yusuf',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'DECEASED',
    birth: { qualifier: 'ABOUT', text: '1901', place: 'Masaka, Uganda' },
    death: { date: '1974-03-11', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Coffee farmer',
    biography:
      'Kept the family land at Masaka through three changes of government. Known for ' +
      'settling disputes between neighbours under the mango tree behind the house.',
  },
  {
    n: 2,
    givenName: 'Amina',
    familyName: 'Kwesiga',
    maidenName: 'Nassuna',
    gender: 'female',
    livingStatus: 'DECEASED',
    birth: { date: '1906-08-02', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    death: { date: '1988-11-30', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Midwife',
    biography: 'Delivered most of the children born in her village between 1930 and 1965.',
  },

  // ---- Generation 2 ------------------------------------------------------
  {
    n: 3,
    givenName: 'Peter',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'DECEASED',
    birth: { date: '1930-01-19', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    death: { date: '2004-06-04', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Railway engineer',
    biography:
      'Moved to Kampala in 1975 for work on the railway. Built the house at Nakawa in 1982.',
  },
  {
    n: 4,
    givenName: 'Sarah',
    familyName: 'Nakato',
    gender: 'female',
    livingStatus: 'DECEASED',
    birth: { date: '1933-04-27', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    death: { date: '2019-09-15', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Teacher',
  },
  {
    n: 5,
    givenName: 'Daniel',
    familyName: 'Kwesiga',
    gender: 'male',
    // No death record. NOT assumed living - a man born about 1936 with no
    // record is exactly the case that must not be mislabelled either way.
    livingStatus: 'UNKNOWN',
    birth: { qualifier: 'ABOUT', text: '1936', place: 'Masaka, Uganda' },
    notes: 'Left for Nairobi in the early 1960s. The family lost contact after 1971.',
  },
  {
    n: 6,
    givenName: 'Josephine',
    familyName: 'Kwesiga',
    maidenName: 'Nabirye',
    gender: 'female',
    livingStatus: 'DECEASED',
    birth: { date: '1935-12-08', qualifier: 'EXACT', place: 'Jinja, Uganda' },
    death: { date: '1998-02-20', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Seamstress',
  },
  {
    n: 7,
    givenName: 'Esther',
    familyName: 'Kwesiga',
    maidenName: 'Namutebi',
    gender: 'female',
    livingStatus: 'LIVING',
    birth: { date: '1950-05-14', qualifier: 'EXACT', place: 'Mukono, Uganda' },
    occupation: 'Shopkeeper',
  },

  // ---- Generation 3 ------------------------------------------------------
  {
    n: 8,
    givenName: 'John',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1958-07-03', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Accountant',
  },
  {
    n: 9,
    givenName: 'Grace',
    familyName: 'Kwesiga',
    gender: 'female',
    livingStatus: 'LIVING',
    birth: { date: '1961-10-22', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Nurse',
  },
  {
    n: 10,
    givenName: 'Moses',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1992-03-30', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Software developer',
  },
  {
    n: 11,
    givenName: 'Robert',
    familyName: 'Ssali',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1960-02-11', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Carpenter',
    notes: 'Father not recorded.',
  },
  {
    n: 12,
    givenName: 'Ruth',
    familyName: 'Kwesiga',
    maidenName: 'Atim',
    gender: 'female',
    livingStatus: 'LIVING',
    birth: { date: '1962-06-18', qualifier: 'EXACT', place: 'Gulu, Uganda' },
    occupation: 'Headteacher',
  },
  {
    n: 13,
    givenName: 'Samuel',
    familyName: 'Okello',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1959-11-05', qualifier: 'EXACT', place: 'Lira, Uganda' },
    occupation: 'Civil servant',
  },

  // ---- Generation 4 ------------------------------------------------------
  {
    n: 14,
    givenName: 'Fred',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1988-09-12', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Engineer',
  },
  {
    n: 15,
    givenName: 'Miriam',
    familyName: 'Kwesiga',
    gender: 'female',
    livingStatus: 'LIVING',
    birth: { date: '1991-01-25', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Doctor',
  },
  {
    n: 16,
    givenName: 'Anna',
    familyName: 'Kwesiga',
    gender: 'female',
    livingStatus: 'LIVING',
    birth: { date: '1995-04-08', qualifier: 'EXACT', place: 'Kampala, Uganda' },
    occupation: 'Architect',
  },
  {
    n: 17,
    givenName: 'David',
    familyName: 'Ssali',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '1985-08-19', qualifier: 'EXACT', place: 'Masaka, Uganda' },
    occupation: 'Journalist',
  },

  // ---- Generation 5 ------------------------------------------------------
  {
    n: 18,
    givenName: 'Isaac',
    familyName: 'Kwesiga',
    gender: 'male',
    livingStatus: 'LIVING',
    birth: { date: '2020-02-29', qualifier: 'EXACT', place: 'Kampala, Uganda' },
  },
];

interface SeedParentChild {
  parent: number;
  child: number;
  type?: 'BIOLOGICAL' | 'ADOPTIVE' | 'STEP' | 'FOSTER' | 'GUARDIAN';
  certainty?: 'CONFIRMED' | 'PROBABLE' | 'DISPUTED';
  notes?: string;
}

const PARENT_CHILD: SeedParentChild[] = [
  // Yusuf + Amina -> Peter, Sarah, Daniel
  { parent: 1, child: 3 },
  { parent: 2, child: 3 },
  { parent: 1, child: 4 },
  { parent: 2, child: 4 },
  { parent: 1, child: 5 },
  { parent: 2, child: 5 },

  // Peter + Josephine -> John, Grace
  { parent: 3, child: 8 },
  { parent: 6, child: 8 },
  { parent: 3, child: 9 },
  { parent: 6, child: 9 },

  // Peter + Esther -> Moses. Half-sibling of John and Grace: they share Peter
  // and nothing else. This falls out of the model with no special handling.
  { parent: 3, child: 10 },
  { parent: 7, child: 10 },

  // Esther is also step-mother to Peter's older children. Both facts coexist.
  { parent: 7, child: 8, type: 'STEP' },
  { parent: 7, child: 9, type: 'STEP' },

  // Sarah -> Robert. One row. The father is simply not recorded - no
  // placeholder person, no null father_id, nothing to explain away.
  { parent: 4, child: 11, notes: 'Father not recorded.' },

  // John + Ruth -> Fred, Miriam
  { parent: 8, child: 14 },
  { parent: 12, child: 14 },
  { parent: 8, child: 15 },
  { parent: 12, child: 15 },

  // Grace + Samuel adopted Anna
  { parent: 9, child: 16, type: 'ADOPTIVE' },
  { parent: 13, child: 16, type: 'ADOPTIVE' },

  // Robert -> David
  { parent: 11, child: 17 },

  // Fred -> Isaac
  { parent: 14, child: 18 },
];

interface SeedPartnership {
  a: number;
  b: number;
  type?: 'MARRIAGE' | 'PARTNERSHIP' | 'UNION';
  status: 'ACTIVE' | 'SEPARATED' | 'DIVORCED' | 'ENDED_BY_DEATH';
  start?: string;
  startText?: string;
  end?: string;
  place?: string;
}

const PARTNERSHIPS: SeedPartnership[] = [
  { a: 1, b: 2, status: 'ENDED_BY_DEATH', startText: 'about 1928', place: 'Masaka, Uganda' },
  { a: 3, b: 6, status: 'ENDED_BY_DEATH', start: '1956-12-15', place: 'Masaka, Uganda' },
  // The remarriage. A second row, not an edit of the first.
  { a: 3, b: 7, status: 'ENDED_BY_DEATH', start: '2000-08-05', place: 'Kampala, Uganda' },
  { a: 8, b: 12, status: 'ACTIVE', start: '1986-04-26', place: 'Kampala, Uganda' },
  { a: 9, b: 13, status: 'ACTIVE', start: '1990-07-14', place: 'Kampala, Uganda' },
];

async function main(): Promise<void> {
  console.log('Seeding the Kwesiga fixture family...\n');

  // 1. Clean slate. Deleting the Family cascades to every row it owns.
  await prisma.family.deleteMany({ where: { id: FAMILY_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });

  // 2. The owner account. No passwordHash yet - authentication is Phase 3.
  await prisma.user.create({
    data: {
      id: USER_ID,
      email: 'fred@example.com',
      name: 'Fred Kwesiga',
      emailVerifiedAt: new Date(),
    },
  });

  // 3. The tenant.
  await prisma.family.create({
    data: {
      id: FAMILY_ID,
      name: 'The Kwesiga Family',
      description: 'From Masaka to Kampala, five generations.',
      hideLivingFromViewers: true,
      aiEnabled: false, // off by default, always
      defaultRootMemberId: M(14),
    },
  });

  // 4. People.
  await prisma.member.createMany({
    data: MEMBERS.map((m) => ({
      id: M(m.n),
      familyId: FAMILY_ID,
      givenName: m.givenName,
      familyName: m.familyName,
      maidenName: m.maidenName ?? null,
      displayName: `${m.givenName} ${m.familyName}`,
      gender: m.gender,
      livingStatus: m.livingStatus,
      birthDate: m.birth?.date ? exact(m.birth.date) : null,
      birthDateQualifier: m.birth?.qualifier ?? null,
      birthDateText: m.birth?.text ?? null,
      birthPlace: m.birth?.place ?? null,
      deathDate: m.death?.date ? exact(m.death.date) : null,
      deathDateQualifier: m.death?.qualifier ?? null,
      deathDateText: m.death?.text ?? null,
      deathPlace: m.death?.place ?? null,
      occupation: m.occupation ?? null,
      biography: m.biography ?? null,
      notes: m.notes ?? null,
      sortIndex: m.n,
      createdById: USER_ID,
    })),
  });

  // 5. The owner's membership, claiming their own Member record.
  await prisma.familyMembership.create({
    data: {
      userId: USER_ID,
      familyId: FAMILY_ID,
      role: 'OWNER',
      claimedMemberId: M(14),
    },
  });

  // 6. Descent edges.
  await prisma.parentChild.createMany({
    data: PARENT_CHILD.map((e) => ({
      familyId: FAMILY_ID,
      parentId: M(e.parent),
      childId: M(e.child),
      relationType: e.type ?? 'BIOLOGICAL',
      certainty: e.certainty ?? 'CONFIRMED',
      notes: e.notes ?? null,
    })),
  });

  // 7. Partnerships. The pair is sorted before insert so it satisfies the
  //    memberAId < memberBId CHECK constraint. Do this everywhere partnerships
  //    are written - it is what keeps one row per couple canonical.
  await prisma.partnership.createMany({
    data: PARTNERSHIPS.map((p) => {
      const [first, second] = [M(p.a), M(p.b)].sort();
      return {
        familyId: FAMILY_ID,
        memberAId: first as string,
        memberBId: second as string,
        type: p.type ?? 'MARRIAGE',
        status: p.status,
        startDate: p.start ? exact(p.start) : null,
        startDateQualifier: p.start ? ('EXACT' as const) : p.startText ? ('ABOUT' as const) : null,
        startDateText: p.startText ?? null,
        endDate: p.end ? exact(p.end) : null,
        place: p.place ?? null,
      };
    }),
  });

  // 8. Stories. Both written by a human - nothing in the seed pretends to be
  //    AI-assisted, so the provenance flag is never wrong out of the box.
  const story1 = await prisma.story.create({
    data: {
      familyId: FAMILY_ID,
      title: "Peter's journey to Kampala",
      body:
        'In 1975 Peter left the family land at Masaka and took the position with the railway ' +
        'in Kampala. He travelled first, alone, and sent for Josephine and the children once ' +
        'he had found rooms in Nakawa. Grace remembers the journey as two days on a lorry.\n\n' +
        'He stayed with the railway for twenty-six years. The house at Nakawa was finished in ' +
        '1982 and every one of his children was married from it.',
      source: 'HUMAN',
      eventDate: null,
      eventDateQualifier: 'ABOUT',
      eventDateText: '1975',
      place: 'Kampala, Uganda',
      visibility: 'FAMILY',
      authorUserId: USER_ID,
    },
  });

  const story2 = await prisma.story.create({
    data: {
      familyId: FAMILY_ID,
      title: 'The mango tree at Masaka',
      body:
        'Yusuf settled disputes under the mango tree behind the house. Neighbours came to him ' +
        'rather than to the sub-county court, and he kept no record of any of it. Amina said ' +
        'he never once took a side before both people had finished speaking.',
      source: 'HUMAN',
      eventDateQualifier: 'RANGE',
      eventDateText: '1940s-1960s',
      place: 'Masaka, Uganda',
      visibility: 'FAMILY',
      authorUserId: USER_ID,
    },
  });

  await prisma.storySubject.createMany({
    data: [
      { storyId: story1.id, memberId: M(3), familyId: FAMILY_ID },
      { storyId: story1.id, memberId: M(6), familyId: FAMILY_ID },
      { storyId: story1.id, memberId: M(9), familyId: FAMILY_ID },
      { storyId: story2.id, memberId: M(1), familyId: FAMILY_ID },
      { storyId: story2.id, memberId: M(2), familyId: FAMILY_ID },
    ],
  });

  // 9. Timeline events.
  await prisma.event.createMany({
    data: [
      {
        familyId: FAMILY_ID,
        memberId: M(3),
        type: 'MIGRATION',
        title: 'Moved from Masaka to Kampala',
        description: 'Took a position with the railway.',
        dateQualifier: 'ABOUT',
        dateText: '1975',
        place: 'Kampala, Uganda',
      },
      {
        familyId: FAMILY_ID,
        memberId: M(3),
        type: 'ACHIEVEMENT',
        title: 'Built the house at Nakawa',
        date: exact('1982-11-01'),
        dateQualifier: 'ABOUT',
        dateText: 'late 1982',
        place: 'Nakawa, Kampala',
      },
      {
        familyId: FAMILY_ID,
        memberId: M(8),
        type: 'EDUCATION',
        title: 'Graduated from Makerere University',
        date: exact('1981-10-17'),
        dateQualifier: 'EXACT',
        place: 'Kampala, Uganda',
      },
      {
        familyId: FAMILY_ID,
        memberId: M(5),
        type: 'MIGRATION',
        title: 'Left for Nairobi',
        description: 'The family lost contact after 1971.',
        dateQualifier: 'ABOUT',
        dateText: 'early 1960s',
        place: 'Nairobi, Kenya',
      },
    ],
  });

  // ---- Summary ------------------------------------------------------------
  const counts = {
    members: await prisma.member.count({ where: { familyId: FAMILY_ID } }),
    parentChild: await prisma.parentChild.count({ where: { familyId: FAMILY_ID } }),
    partnerships: await prisma.partnership.count({ where: { familyId: FAMILY_ID } }),
    stories: await prisma.story.count({ where: { familyId: FAMILY_ID } }),
    events: await prisma.event.count({ where: { familyId: FAMILY_ID } }),
  };

  console.log('  The Kwesiga Family');
  console.log(`  family id      ${FAMILY_ID}`);
  console.log(`  owner          fred@example.com`);
  console.log(`  members        ${counts.members}`);
  console.log(`  parent-child   ${counts.parentChild}`);
  console.log(`  partnerships   ${counts.partnerships}`);
  console.log(`  stories        ${counts.stories}`);
  console.log(`  events         ${counts.events}`);
  console.log('\n  Cases covered: remarriage, half-siblings, adoption, step-parents,');
  console.log('  unknown parent, unknown living status, approximate dates, no photos.\n');
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Prisma error ${error.code}: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });