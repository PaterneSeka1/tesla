/**
 * Communauté de démonstration (environnement local uniquement, jamais en production) : de quoi
 * parcourir l'application comme un routier, un adulte, un membre de l'encadrement, le responsable
 * plein ou l'administrateur. Personnes, adresses et matricules **inventés** (aucune donnée réelle) ;
 * adresses en `.local`, jamais délivrables. Idempotent : un compte, une fiche, une affectation ou
 * une désignation existante n'est jamais modifiée (le mot de passe est seulement réaligné).
 *
 * Contenu : administrateur, responsable plein, adjoint, deux assistants ; seize routiers répartis
 * sur les quatre étapes (référentiel d'âge en vigueur, aucune étape saisie, D173) et trois équipes ;
 * cas à tester : arrivée tardive (rattrapages, s'il existe un module obligatoire publié), sortie de la branche dans quelques jours, routier
 * sans compte, compte à rattacher, apprenant adulte. Le catalogue importé est mis en service au nom
 * du plein ; un module d'entraînement (faits du référentiel et des règles de validation, D194) est
 * soumis par un assistant et attend l'approbation du plein. Aucun événement du programme n'est
 * inventé. Les anciens comptes « Démo » et équipes « Recette » sont désactivés ou archivés, jamais
 * supprimés.
 */
import {
  addCalendarDays,
  addCalendarMonths,
  civilDateAt,
  type LessonBlock,
  type PracticeActivity,
} from '@tesla/shared';
import { type Actor } from '../../src/common/actor.js';
import { type PrismaClient } from '../../src/generated/prisma/client.js';
import { type LeaderFunction, type Role } from '../../src/generated/prisma/enums.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { ModuleEditorService } from '../../src/modules/pedagogy/module-editor.service.js';
import { PathwayService } from '../../src/modules/progression/pathway.service.js';
import { type PrismaService } from '../../src/prisma/prisma.service.js';
import { formatReleaseReport, releaseActor, releaseCatalog } from './release-catalog.js';

const DOMAIN = 'nikolatesla.local';
const JOINED_AT = '2026-09-05';
const TEAMS = ['Baobab', 'Lagune', 'Savane'] as const;

type Sex = 'GARCON' | 'FILLE';

interface Person {
  firstName: string;
  lastName: string;
  sex: Sex;
}

interface StaffSeed extends Person {
  role: Role;
  function?: LeaderFunction;
}

interface RoutierSeed extends Person {
  /** Âge : années, mois et jours écoulés depuis la naissance (l'étape en découle, D173). */
  age: [number, number, number];
  team: (typeof TEAMS)[number] | null;
  matricule?: string;
  /** Arrivée récente (rattrapages des étapes échues, D177). */
  joinedDaysAgo?: number;
  /** Fiche sans compte (routier suivi sur papier, RM-001). */
  noAccount?: boolean;
}

const STAFF: StaffSeed[] = [
  { firstName: 'Aya', lastName: 'Konan', sex: 'FILLE', role: 'ADMINISTRATEUR' },
  {
    firstName: 'Serge',
    lastName: 'Kouassi',
    sex: 'GARCON',
    role: 'ENCADREMENT',
    function: 'PLEIN',
  },
  {
    firstName: 'Mariam',
    lastName: 'Traoré',
    sex: 'FILLE',
    role: 'ENCADREMENT',
    function: 'ADJOINT',
  },
  {
    firstName: 'Yao',
    lastName: 'N’Guessan',
    sex: 'GARCON',
    role: 'ENCADREMENT',
    function: 'ASSISTANT',
  },
  {
    firstName: 'Fatou',
    lastName: 'Diabaté',
    sex: 'FILLE',
    role: 'ENCADREMENT',
    function: 'ASSISTANT',
  },
];

const ROUTIERS: RoutierSeed[] = [
  // Noviciat (dans le premier mois après le 18e anniversaire).
  {
    firstName: 'Koffi',
    lastName: 'Yao',
    sex: 'GARCON',
    age: [18, 0, 10],
    team: 'Baobab',
    matricule: '2601001A',
  },
  { firstName: 'Adjoua', lastName: 'Kouamé', sex: 'FILLE', age: [18, 0, 18], team: 'Lagune' },
  { firstName: 'Moussa', lastName: 'Cissé', sex: 'GARCON', age: [18, 0, 5], team: 'Savane' },
  // Apprentissage.
  {
    firstName: 'Awa',
    lastName: 'Bamba',
    sex: 'FILLE',
    age: [18, 4, 0],
    team: 'Baobab',
    matricule: '2601002B',
  },
  { firstName: 'Jean-Marc', lastName: 'Aka', sex: 'GARCON', age: [18, 7, 12], team: 'Lagune' },
  {
    firstName: 'Salimata',
    lastName: 'Ouattara',
    sex: 'FILLE',
    age: [18, 9, 3],
    team: 'Savane',
    matricule: '2601003C',
  },
  { firstName: 'Ange', lastName: 'Tanoh', sex: 'GARCON', age: [18, 11, 20], team: 'Baobab' },
  // Compagnonnage.
  {
    firstName: 'Ruth',
    lastName: 'Gnamien',
    sex: 'FILLE',
    age: [19, 3, 0],
    team: 'Lagune',
    matricule: '2601004D',
  },
  { firstName: 'Ismaël', lastName: 'Koné', sex: 'GARCON', age: [19, 6, 15], team: 'Savane' },
  { firstName: 'Prisca', lastName: 'Ehui', sex: 'FILLE', age: [19, 9, 2], team: 'Baobab' },
  // Arrivé la semaine dernière en Compagnonnage : rattrapages du Noviciat et de l'Apprentissage dès
  // qu'un module obligatoire de ces étapes est publié avec sa source officielle (D177).
  {
    firstName: 'Didier',
    lastName: 'Séka',
    sex: 'GARCON',
    age: [19, 2, 0],
    team: 'Lagune',
    joinedDaysAgo: 6,
  },
  // Préparation au Départ routier.
  {
    firstName: 'Bintou',
    lastName: 'Sangaré',
    sex: 'FILLE',
    age: [20, 2, 0],
    team: 'Savane',
    matricule: '2601005E',
  },
  { firstName: 'Hervé', lastName: 'Assi', sex: 'GARCON', age: [20, 6, 9], team: 'Baobab' },
  // Sortie de la branche dans une quinzaine de jours (21e anniversaire).
  { firstName: 'Nadège', lastName: 'Yapo', sex: 'FILLE', age: [20, 11, 15], team: 'Lagune' },
  // Fiches sans compte : suivi papier (évaluations imprimées, saisie par l'encadrement).
  {
    firstName: 'Lassina',
    lastName: 'Fofana',
    sex: 'GARCON',
    age: [18, 5, 0],
    team: 'Savane',
    noAccount: true,
  },
  {
    firstName: 'Estelle',
    lastName: 'Brou',
    sex: 'FILLE',
    age: [19, 4, 0],
    team: 'Baobab',
    noAccount: true,
  },
];

/** Compte sans fiche : à rattacher depuis l'administration (RM-001). */
const UNLINKED: Person = { firstName: 'Ibrahim', lastName: 'Coulibaly', sex: 'GARCON' };
/** Apprenant adulte (D185) : cours, défis et évaluations, aucune donnée de la Route. */
const ADULT: Person = { firstName: 'Christelle', lastName: 'Aké', sex: 'FILLE' };

const PRACTICE_MODULE_TITLE = 'S’entraîner : repères de la progression';

/** Adresse sans accent ni apostrophe : prenom.nom@nikolatesla.local. */
export function demoEmail(person: Pick<Person, 'firstName' | 'lastName'>): string {
  const clean = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z]+/g, '')
      .toLowerCase();
  return `${clean(person.firstName)}.${clean(person.lastName)}@${DOMAIN}`;
}

function birthDate(today: string, [years, months, days]: [number, number, number]): Date {
  return new Date(
    `${addCalendarDays(addCalendarMonths(today, -(12 * years + months)), -days)}T00:00:00Z`,
  );
}

export async function seedDemoCommunity(prisma: PrismaClient, password: string): Promise<void> {
  const today = civilDateAt(new Date());
  const passwordHash = await hashPassword(password);

  // 1. Anciennes données de démonstration : désactivées ou archivées, jamais supprimées.
  const legacy = await prisma.user.updateMany({
    where: { email: { endsWith: '.demo@tesla.test' }, isActive: true },
    data: { isActive: false },
  });
  await prisma.scoutProfile.updateMany({
    where: { user: { email: { endsWith: '.demo@tesla.test' } }, isActive: true },
    data: { isActive: false },
  });
  const archived = await prisma.team.updateMany({
    where: { name: { startsWith: 'Recette ' }, archivedAt: null },
    data: { archivedAt: new Date() },
  });

  // 2. Comptes.
  const account = async (person: Person, role: Role) =>
    prisma.user.upsert({
      where: { email: demoEmail(person) },
      create: {
        email: demoEmail(person),
        firstName: person.firstName,
        lastName: person.lastName,
        role,
        passwordHash,
      },
      update: { passwordHash, isActive: true },
      include: { scoutProfile: { select: { id: true } } },
    });

  const staff = new Map<string, string>();
  for (const member of STAFF) {
    const user = await account(member, member.role);
    staff.set(member.function ?? member.role, user.id);
    if (!member.function) continue;
    const open = await prisma.leadershipAssignment.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    const pleinTaken =
      member.function === 'PLEIN' &&
      (await prisma.leadershipAssignment.findFirst({
        where: { function: 'PLEIN', endedAt: null },
      }));
    if (open || pleinTaken) continue;
    await prisma.leadershipAssignment.create({
      data: {
        userId: user.id,
        function: member.function,
        reason: 'Désignation pour l’année scoute 2026–2027',
        assignedById: staff.get('ADMINISTRATEUR') ?? null,
      },
    });
  }
  const pleinId = staff.get('PLEIN')!;

  // 3. Équipes (créées une fois, jamais renommées).
  const teams = new Map<string, string>();
  for (const name of TEAMS) {
    const team = await prisma.team.upsert({ where: { name }, create: { name }, update: {} });
    teams.set(name, team.id);
  }

  // 4. Fiches routiers (étape calculée selon l'âge), équipes, comptes rattachés.
  let profiles = 0;
  for (const routier of ROUTIERS) {
    const user = routier.noAccount ? null : await account(routier, 'ROUTIER');
    const existing = user
      ? user.scoutProfile
      : await prisma.scoutProfile.findFirst({
          where: { firstName: routier.firstName, lastName: routier.lastName, userId: null },
          select: { id: true },
        });
    if (existing) continue;
    const joinedAt = routier.joinedDaysAgo
      ? addCalendarDays(today, -routier.joinedDaysAgo)
      : JOINED_AT;
    await prisma.$transaction(async (tx) => {
      const profile = await tx.scoutProfile.create({
        data: {
          userId: user?.id ?? null,
          firstName: routier.firstName,
          lastName: routier.lastName,
          sex: routier.sex,
          matricule: routier.matricule ?? null,
          birthDate: birthDate(today, routier.age),
          joinedAt: new Date(`${joinedAt}T00:00:00Z`),
        },
      });
      if (routier.team) {
        await tx.teamAssignment.create({
          data: {
            scoutProfileId: profile.id,
            teamId: teams.get(routier.team)!,
            startedAt: new Date(`${joinedAt}T00:00:00Z`),
            assignedById: pleinId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'scout_profile.created',
          entityType: 'ScoutProfile',
          entityId: profile.id,
          metadata: { source: 'seed' },
        },
      });
    });
    profiles += 1;
  }
  await account(UNLINKED, 'ROUTIER');
  const adult = await account(ADULT, 'ADULTE');
  if (!adult.scoutProfile) {
    await prisma.scoutProfile.create({
      data: {
        kind: 'ADULTE',
        userId: adult.id,
        firstName: ADULT.firstName,
        lastName: ADULT.lastName,
        sex: ADULT.sex,
      },
    });
  }

  // 5. Catalogue importé mis en service au nom du plein (démonstration locale uniquement).
  const plein = await releaseActor(prisma);
  console.log(formatReleaseReport(await releaseCatalog(prisma, plein, { acknowledgeNotes: true })));

  // 6. Module d'entraînement soumis par un assistant : le plein l'approuve depuis l'application.
  const assistant: Actor = {
    userId: staff.get('ASSISTANT')!,
    role: 'ENCADREMENT',
    leaderFunction: 'ASSISTANT',
  };
  const exists = await prisma.moduleVersion.findFirst({ where: { title: PRACTICE_MODULE_TITLE } });
  if (!exists) await submitPracticeModule(prisma, assistant);

  // 7. Plans de rattrapage (comme le traitement quotidien).
  const catchUps = await new PathwayService(prisma as unknown as PrismaService).syncAllCatchUps(
    today,
  );

  console.log(
    `Démonstration : ${STAFF.length + ROUTIERS.filter((r) => !r.noAccount).length + 2} comptes (mot de passe DEMO_ACCOUNT_PASSWORD), ${profiles} fiche(s) créée(s), ${catchUps.created} rattrapage(s) ; ${legacy.count} ancien(s) compte(s) désactivé(s), ${archived.count} équipe(s) archivée(s).`,
  );
  console.log(
    `Connexion : ${demoEmail(STAFF[1]!)} (plein), ${demoEmail(STAFF[3]!)} (assistant), ${demoEmail(STAFF[0]!)} (administration), ${demoEmail(ROUTIERS[0]!)} (routier), ${demoEmail(ADULT)} (adulte).`,
  );
}

// ─── Module d'entraînement (faits du référentiel 2026.3 et des règles de validation) ─────────

const p = (text: string): LessonBlock => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const practice = (activity: PracticeActivity): LessonBlock => ({
  type: 'practice',
  attrs: { activity },
});

const LESSONS: { title: string; durationMinutes: number; content: LessonBlock[] }[] = [
  {
    title: 'Les étapes et les âges',
    durationMinutes: 10,
    content: [
      p(
        'Dans la communauté, l’étape de chaque routier découle de sa date de naissance et du référentiel d’âge en vigueur : personne ne la saisit.',
      ),
      practice({
        kind: 'order',
        id: 'reperes-etapes-ordre',
        title: 'Les étapes dans l’ordre',
        steps: [
          { label: 'Noviciat', marker: '18 ans' },
          { label: 'Apprentissage', marker: '18 ans et 1 mois' },
          { label: 'Compagnonnage', marker: '19 ans' },
          { label: 'Préparation au Départ routier', marker: '20 ans' },
        ],
      }),
      practice({
        kind: 'match',
        id: 'reperes-etapes-ages',
        title: 'Chaque étape et sa période',
        pairs: [
          { left: 'Noviciat', right: 'Du 18e anniversaire à 18 ans et 1 mois' },
          { left: 'Apprentissage', right: 'De 18 ans et 1 mois à la veille du 19e anniversaire' },
          { left: 'Compagnonnage', right: 'Du 19e au 20e anniversaire' },
          { left: 'Départ routier', right: 'Du 20e au 21e anniversaire' },
        ],
      }),
      practice({
        kind: 'quiz',
        id: 'reperes-calendrier',
        title: 'Le calendrier de la Route',
        items: [
          {
            prompt: 'Quel jour un routier sort-il de la branche Route ?',
            options: [
              'Le jour de ses 20 ans',
              'Le jour de ses 21 ans',
              'À la fin de l’année scoute',
            ],
            answer: 1,
            explanation:
              'La sortie de la branche a lieu le jour du 21e anniversaire ; rien n’est supprimé.',
          },
          {
            prompt: 'Combien de jours compte le délai pour rattraper une étape ?',
            options: ['7 jours', '14 jours', '21 jours', '30 jours'],
            answer: 2,
            hint: 'Environ trois semaines.',
            explanation:
              'Chaque étape à rattraper dispose de 21 jours ; les étapes se rattrapent dans l’ordre.',
          },
          {
            prompt:
              'Combien de jours avant l’échéance d’un rattrapage l’alerte « échéance proche » apparaît-elle ?',
            options: ['3 jours', '7 jours', '14 jours'],
            answer: 1,
          },
        ],
      }),
    ],
  },
  {
    title: 'Ce que valent les résultats',
    durationMinutes: 10,
    content: [
      p(
        'Une évaluation mesure une compréhension ; un acquis se valide par une décision humaine. Les défis et les badges servent à s’entraîner.',
      ),
      practice({
        kind: 'truefalse',
        id: 'reperes-resultats-vf',
        title: 'Résultats et validations',
        items: [
          {
            statement: 'Pendant un rattrapage, tous les cours publiés restent consultables.',
            answer: true,
            explanation:
              'Seules les évaluations des autres modules attendent la fin du rattrapage.',
          },
          {
            statement: 'Un bon score à une évaluation valide automatiquement un acquis.',
            answer: false,
            explanation:
              'La validation officielle d’un acquis est un acte séparé du responsable plein.',
          },
          {
            statement: 'Les XP et les badges font changer d’étape.',
            answer: false,
            explanation: 'Ils récompensent l’entraînement ; l’étape suit l’âge.',
          },
          {
            statement: 'Un routier sans compte peut composer une évaluation sur papier.',
            answer: true,
          },
        ],
      }),
      practice({
        kind: 'flashcards',
        id: 'reperes-cartes',
        title: 'Qui décide ?',
        cards: [
          {
            front: 'Qui valide officiellement un acquis ?',
            back: 'Le responsable plein en fonction, par un acte séparé du résultat d’évaluation.',
          },
          {
            front: 'Comment l’étape d’un routier est-elle déterminée ?',
            back: 'Par sa date de naissance et le référentiel d’âge en vigueur.',
          },
          {
            front: 'Qui accorde un déblocage individuel d’évaluation ?',
            back: 'Le responsable plein : déblocage nominatif, motivé et révocable.',
          },
        ],
      }),
    ],
  },
];

async function submitPracticeModule(prisma: PrismaClient, actor: Actor): Promise<void> {
  const editor = new ModuleEditorService(prisma as unknown as PrismaService);
  const { id } = await editor.create(actor, {
    title: PRACTICE_MODULE_TITLE,
    summary: 'Activités pour mémoriser les étapes, les âges et le sens des résultats.',
    objectives: [
      'Situer les étapes de la Route et leurs périodes',
      'Distinguer résultat d’évaluation, acquis et étape',
    ],
    durationMinutes: 20,
    category: 'TRANSVERSAL',
    obligation: 'FACULTATIF',
  });
  const { id: versionId } = await prisma.moduleVersion.findFirstOrThrow({
    where: { moduleId: id, status: 'BROUILLON' },
    select: { id: true },
  });
  for (const lesson of LESSONS) {
    await editor.addLesson(actor, id, {
      versionId,
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
      content: { type: 'doc', content: lesson.content },
    });
  }
  const { revision } = await prisma.moduleVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: { revision: true },
  });
  await editor.submit(actor, id, {
    versionId,
    revision,
    note: 'Activités d’entraînement à valider.',
  });
}
