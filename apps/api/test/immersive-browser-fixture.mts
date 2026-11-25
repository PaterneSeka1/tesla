/**
 * Fixture de la recette navigateur de l'expérience immersive (D194–D200,
 * apps/web/test/immersive.browser.mjs). Base « _test » uniquement (TEST_DATABASE_URL), remise à
 * zéro à chaque passage : comptes fictifs, catalogue réel importé et mis en service, plus un module
 * fictif d'entraînement contenant une activité de chaque type. Depuis apps/api :
 *   TEST_DATABASE_URL=… npx tsx test/immersive-browser-fixture.mts
 */
import { addCalendarDays, addCalendarMonths, civilDateAt, type LessonBlock } from '@tesla/shared';
import {
  seedAgeRuleSet2026_2,
  seedAgeRuleSet2026_3,
  seedInitialAgeRuleSet,
} from '../prisma/seeds/age-rules.seed.js';
import {
  formatReleaseReport,
  releaseActor,
  releaseCatalog,
} from '../prisma/seeds/release-catalog.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from '../prisma/seeds/route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from '../prisma/seeds/scoutisme-base.seed.js';
import { importSourceModules } from '../prisma/seeds/source-modules.js';
import { type Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma, resetDatabase } from './int-database.js';

if (!/_test(\?|$)/.test(process.env.TEST_DATABASE_URL ?? '')) {
  throw new Error('Fixture réservée à une base « _test ».');
}
const db = createTestPrisma();
await resetDatabase(db);
await seedInitialAgeRuleSet(db);
await seedAgeRuleSet2026_2(db);
await seedAgeRuleSet2026_3(db);
const passwordHash = await hashPassword('phrase-fictive-recette-immersive');
const today = civilDateAt(new Date());
const born = (years: number, days: number) =>
  new Date(`${addCalendarDays(addCalendarMonths(today, -12 * years), -days)}T00:00:00Z`);
const person = (
  email: string,
  lastName: string,
  role: 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ADULTE',
) => db.user.create({ data: { email, firstName: 'Fictif', lastName, role, passwordHash } });

await person('admin-immersif@recette.test', 'Administration', 'ADMINISTRATEUR');
const plein = await person('plein-immersif@recette.test', 'Plein', 'ENCADREMENT');
await db.leadershipAssignment.create({
  data: { userId: plein.id, function: 'PLEIN', reason: 'Désignation fictive (recette)' },
});
const chef = await person('chef-immersif@recette.test', 'Assistant', 'ENCADREMENT');
await db.leadershipAssignment.create({
  data: { userId: chef.id, function: 'ASSISTANT', reason: 'Désignation fictive (recette)' },
});
const routier = await person('routier-immersif@recette.test', 'Novice', 'ROUTIER');
await db.scoutProfile.create({
  data: {
    userId: routier.id,
    firstName: 'Fictif',
    lastName: 'Novice',
    birthDate: born(18, 30),
    joinedAt: new Date(`${today}T00:00:00Z`),
  },
});
const adulte = await person('adulte-immersif@recette.test', 'Adulte', 'ADULTE');
await db.scoutProfile.create({
  data: { kind: 'ADULTE', userId: adulte.id, firstName: 'Fictif', lastName: 'Adulte' },
});

// Catalogue réel (contenu publié de référence) mis en service au nom du plein fictif.
await importSourceModules(db, [...SCOUTISME_BASE_MODULES, ...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES]);
console.log(
  formatReleaseReport(await releaseCatalog(db, await releaseActor(db), { acknowledgeNotes: true })),
);

// Module fictif d'entraînement : une activité de chaque type (contenu de recette, non pédagogique).
const p = (text: string): LessonBlock => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (text: string): LessonBlock => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
const practice = (activity: object): LessonBlock =>
  ({ type: 'practice', attrs: { activity } }) as LessonBlock;
const lessons: { title: string; content: LessonBlock[] }[] = [
  {
    title: 'Repères fictifs',
    content: [
      h('Première partie'),
      p('Texte fictif de recette : une première notion à découvrir.'),
      h('Deuxième partie'),
      p('Texte fictif de recette : une deuxième notion, à relier à la première.'),
      practice({
        kind: 'quiz',
        id: 'recette-quiz-1',
        title: 'Questions de recette',
        items: Array.from({ length: 6 }, (_, index) => ({
          prompt: `Question fictive n° ${index + 1} : quelle proposition est la bonne ?`,
          options: ['Proposition A', 'Proposition B', 'Proposition C', 'Proposition D'],
          answer: index % 4,
          hint: 'Indice fictif : relisez la deuxième partie.',
          explanation: 'Explication fictive affichée après la réponse.',
        })),
      }),
      h('Troisième partie'),
      p('Texte fictif de recette : une troisième notion pour conclure.'),
      {
        type: 'orderedList',
        content: [
          'Arriver au camp fictif',
          'Monter la tente',
          'Allumer le feu',
          'Partager le repas',
        ].map((text) => ({ type: 'listItem', content: [p(text)] })),
      },
      practice({
        kind: 'truefalse',
        id: 'recette-vf-1',
        items: [
          { statement: 'Affirmation fictive vraie.', answer: true, explanation: 'C’est vrai.' },
          { statement: 'Affirmation fictive fausse.', answer: false },
          { statement: 'Seconde affirmation fictive vraie.', answer: true },
        ],
      }),
    ],
  },
  {
    title: 'Relier et ordonner',
    content: [
      p('Leçon fictive : associations et remise en ordre.'),
      practice({
        kind: 'match',
        id: 'recette-assoc-1',
        title: 'Notions et définitions',
        pairs: [
          { left: 'Notion A', right: 'Définition fictive A' },
          { left: 'Notion B', right: 'Définition fictive B' },
          { left: 'Notion C', right: 'Définition fictive C' },
          { left: 'Notion D', right: 'Définition fictive D' },
        ],
      }),
      practice({
        kind: 'order',
        id: 'recette-frise-1',
        title: 'Frise fictive',
        steps: [
          { label: 'Premier événement fictif', marker: '1907' },
          { label: 'Deuxième événement fictif', marker: '1920' },
          { label: 'Troisième événement fictif', marker: '1937' },
        ],
      }),
      practice({
        kind: 'investigation',
        id: 'recette-enquete-1',
        title: 'Enquête fictive',
        mission: 'Retrouver le personnage fictif décrit par les indices.',
        clues: [
          { label: 'Document', text: 'Indice fictif : il a fondé un mouvement fictif.' },
          { label: 'Date', text: 'Indice fictif : l’événement a lieu en 1907.' },
          { text: 'Indice fictif : son symbole est une boussole.' },
        ],
        question: 'Qui est ce personnage fictif ?',
        options: ['Personnage A', 'Personnage B', 'Personnage C'],
        answer: 1,
        explanation: 'Solution fictive : le personnage B réunit tous les indices.',
      }),
      practice({
        kind: 'order',
        id: 'recette-ordre-1',
        title: 'Étapes fictives',
        steps: [
          { label: 'Préparer', marker: '1' },
          { label: 'Partir', marker: '2' },
          { label: 'Servir', marker: '3' },
          { label: 'Revenir', marker: '4' },
        ],
      }),
    ],
  },
  {
    title: 'Mémoriser et choisir',
    content: [
      p('Leçon fictive : cartes, texte à compléter et mise en situation.'),
      practice({
        kind: 'flashcards',
        id: 'recette-cartes-1',
        cards: [
          { front: 'Recto fictif 1 ?', back: 'Verso fictif 1.' },
          { front: 'Recto fictif 2 ?', back: 'Verso fictif 2.' },
        ],
      }),
      practice({
        kind: 'cloze',
        id: 'recette-texte-1',
        title: 'Texte fictif',
        text: 'Le routier fictif reste [[attentif]] et [[disponible]] pour son équipe.',
      }),
      practice({
        kind: 'scenario',
        id: 'recette-situation-1',
        situation: 'Situation fictive : un membre de l’équipe arrive en retard à une activité.',
        choices: [
          {
            label: 'L’accueillir et lui expliquer ce qui a été fait.',
            insight: 'Éclairage fictif A.',
          },
          { label: 'En parler ensemble après l’activité.', insight: 'Éclairage fictif B.' },
        ],
      }),
    ],
  },
];
const module = await db.pedagogicalModule.create({ data: { slug: 'recette-entrainement' } });
const version = await db.moduleVersion.create({
  data: {
    moduleId: module.id,
    version: 1,
    title: 'Module fictif d’entraînement',
    summary: 'Module de recette (contenu fictif).',
    category: 'TRANSVERSAL',
    obligation: 'FACULTATIF',
  },
});
for (const [position, lesson] of lessons.entries()) {
  await db.moduleLesson.create({
    data: {
      versionId: version.id,
      position,
      title: lesson.title,
      content: structuredClone({ type: 'doc', content: lesson.content }) as Prisma.InputJsonValue,
    },
  });
}
for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
  await db.moduleVersion.update({
    where: { id: version.id },
    data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
  });
}
await db.pedagogicalModule.update({
  where: { id: module.id },
  data: { publishedVersionId: version.id },
});
console.log('Fixture immersive prête.');
await db.$disconnect();
