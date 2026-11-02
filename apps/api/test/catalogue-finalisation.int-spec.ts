import { auditCatalog } from '../prisma/seeds/pedagogy-audit.js';
import { releaseActor, releaseCatalog } from '../prisma/seeds/release-catalog.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from '../prisma/seeds/route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from '../prisma/seeds/scoutisme-base.seed.js';
import { importSourceModules, type SourceModule } from '../prisma/seeds/source-modules.js';
import { currentEditorialNotes } from '../src/modules/pedagogy/module-common.js';
import { type PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, grantPersona, resetDatabase, testDatabaseUrl } from './int-database.js';

// Finalisation du catalogue (2026-11-02) : révision des brouillons importés intacts, vérificateur
// pédagogique et garde de la mise en service. Comptes exclusivement fictifs.

const METHODE = SCOUTISME_BASE_MODULES[2]!;
/** État d'import antérieur de « La méthode scoute » : six leçons vides et des notes « à compléter ». */
const METHODE_V1: SourceModule = {
  ...structuredClone(METHODE),
  stageCode: 'APPRENTISSAGE',
  category: undefined,
  lessons: METHODE.lessons.map((lesson, index) =>
    index === 0 ? lesson : { title: lesson.title, content: { type: 'doc', content: [] } },
  ),
  notes: [{ kind: 'A_COMPLETER', lessonPosition: 1, note: 'Leçon vide : à rédiger.' }],
};
const EMPTY_DRAFT: SourceModule = {
  key: 'NT-TEST-DEC',
  slug: 'nt-test-decouverte-methode-scoute',
  title: 'La méthode scoute en pratique',
  summary: '',
  objectives: [],
  stageCode: null,
  theme: 'Test',
  category: 'TRANSVERSAL',
  sourceDocument: 'Source fictive (tests)',
  sourceSha256: '0'.repeat(64),
  sourcePages: '—',
  lessons: [{ title: 'À rédiger', content: { type: 'doc', content: [] } }],
  notes: [],
};

describe('Finalisation du catalogue (intégration PostgreSQL)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const lessonsOf = async (moduleId: string) =>
    prisma.moduleLesson.findMany({
      where: { version: { moduleId } },
      orderBy: { position: 'asc' },
    });

  it('applique la source révisée à un brouillon intact, avec une révision tracée et sans écraser l’import', async () => {
    const [created] = await importSourceModules(prisma, [METHODE_V1]);
    const moduleId = (created as { moduleId: string }).moduleId;
    const imported = await prisma.moduleSourceImport.findUniqueOrThrow({ where: { moduleId } });

    // Sans l'option, rien n'est écrit : l'écart est seulement signalé comme applicable.
    const [signalled] = await importSourceModules(prisma, [METHODE]);
    expect(signalled).toMatchObject({ outcome: 'DEJA_IMPORTE', revisable: true });
    // Prévisualisation : aucune écriture.
    const [preview] = await importSourceModules(prisma, [METHODE], {
      dryRun: true,
      applyRevisions: true,
    });
    expect(preview).toMatchObject({ outcome: 'A_REVISER', revision: 2 });
    expect(await prisma.moduleSourceRevision.count()).toBe(0);

    const [revised] = await importSourceModules(prisma, [METHODE], { applyRevisions: true });
    expect(revised).toMatchObject({ outcome: 'REVISE', revision: 2 });
    const lessons = await lessonsOf(moduleId);
    expect(lessons.map((lesson) => lesson.title)).toEqual(METHODE.lessons.map((l) => l.title));
    expect(lessons.every((lesson) => JSON.stringify(lesson.content).includes('"text"'))).toBe(true);
    const version = await prisma.moduleVersion.findFirstOrThrow({
      where: { moduleId },
      include: { stage: true },
    });
    expect(version).toMatchObject({ status: 'BROUILLON', category: 'ETAPE', updatedById: null });
    expect(version.stage?.code).toBe('NOVICIAT');
    expect(version.revision).toBe(2);

    // Provenance : l'import d'origine est inchangé, la révision conserve notes et écarts.
    expect(await prisma.moduleSourceImport.findUniqueOrThrow({ where: { moduleId } })).toEqual(
      imported,
    );
    const revision = await prisma.moduleSourceRevision.findFirstOrThrow({ where: { moduleId } });
    expect(revision.revision).toBe(2);
    expect(revision.changes.length).toBeGreaterThan(0);
    expect(await currentEditorialNotes(prisma, moduleId)).toEqual(METHODE.notes);
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: moduleId },
        select: { action: true, actorId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).toEqual([
      { action: 'module.imported', actorId: null },
      { action: 'module.source_revised', actorId: null },
    ]);
    // Aucun événement d'historique attribué au système hors création.
    expect(
      (await prisma.moduleVersionEvent.findMany({ where: { moduleId } })).map((e) => e.action),
    ).toEqual(['CREEE']);

    // Réexécution : plus aucun écart, aucune écriture.
    const [again] = await importSourceModules(prisma, [METHODE], { applyRevisions: true });
    expect(again).toMatchObject({ outcome: 'DEJA_IMPORTE', differences: [], revisable: false });
    expect(await prisma.moduleSourceRevision.count()).toBe(1);

    // Révisions en ajout seul.
    await expect(
      prisma.$executeRaw`UPDATE module_source_revisions SET changes = '{}'`,
    ).rejects.toThrow();
    await expect(prisma.$executeRaw`DELETE FROM module_source_revisions`).rejects.toThrow();
  });

  it('ne réécrit jamais un brouillon modifié par une personne', async () => {
    const [created] = await importSourceModules(prisma, [METHODE_V1]);
    const moduleId = (created as { moduleId: string }).moduleId;
    const chef = await prisma.user.create({
      data: {
        email: 'chef@example.test',
        firstName: 'Fictif',
        lastName: 'Chef',
        role: 'ENCADREMENT',
      },
    });
    const [first] = await lessonsOf(moduleId);
    const edited = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte du chef.' }] }],
    };
    await prisma.moduleLesson.update({
      where: { id: first!.id },
      data: { content: edited, updatedById: chef.id, revision: { increment: 1 } },
    });

    const [result] = await importSourceModules(prisma, [METHODE], { applyRevisions: true });
    expect(result).toMatchObject({ outcome: 'DEJA_IMPORTE', revisable: false });
    expect((result as { differences: string[] }).differences.length).toBeGreaterThan(0);
    expect((await lessonsOf(moduleId))[0]!.content).toEqual(edited);
    expect(await prisma.moduleSourceRevision.count()).toBe(0);
  });

  it('classe le catalogue, signale le texte provisoire et bloque sa publication', async () => {
    const placeholder: SourceModule = {
      ...structuredClone(ROUTE_MODULES[1]!),
      key: 'NT-TEST-PROVISOIRE',
      slug: 'nt-test-provisoire',
      title: 'Module provisoire',
      lessons: [
        {
          title: 'Introduction',
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenu à venir.' }] }],
          },
        },
      ],
      notes: [],
    };
    await importSourceModules(prisma, [
      ...SCOUTISME_BASE_MODULES,
      ...FUNDAMENTAL_TEXTS,
      ...ROUTE_MODULES,
      EMPTY_DRAFT,
      placeholder,
    ]);

    const report = await auditCatalog(prisma);
    const byKey = new Map(report.modules.map((entry) => [entry.sourceKey, entry]));
    // Brouillon vide couvert par « La méthode scoute » : à fusionner, pas destiné aux routiers.
    expect(byKey.get('NT-TEST-DEC')).toMatchObject({
      classification: 'C',
      intendedForPublication: false,
    });
    expect(byKey.get('NT-TEST-PROVISOIRE')!.classification).toBe('A');
    expect(byKey.get('NT-TEST-PROVISOIRE')!.issues.map((i) => i.code)).toContain(
      'TEXTE_PROVISOIRE',
    );
    // Le catalogue rédigé : aucune leçon vide, un questionnaire défini par module d'apprentissage.
    for (const source of [...SCOUTISME_BASE_MODULES, ...ROUTE_MODULES]) {
      const entry = byKey.get(source.key)!;
      expect(entry.emptyLessons, source.key).toBe(0);
      expect(entry.quiz.source, source.key).toBe('DEFINITION');
      expect(
        entry.issues.filter((i) => i.blocking),
        source.key,
      ).toEqual([]);
      expect(['B', 'E'], source.key).toContain(entry.classification);
    }
    expect(report.summary.blockingModules).toBe(1);

    // La mise en service refuse le module provisoire, même avec acquittement des notes.
    const responsable = await prisma.user.create({
      data: {
        email: 'responsable@example.test',
        firstName: 'Fictif',
        lastName: 'Responsable',
        role: 'ENCADREMENT',
      },
    });
    await grantPersona(prisma, responsable.id, 'RESPONSABLE');
    const actor = await releaseActor(prisma);
    const lines = await releaseCatalog(prisma, actor, { acknowledgeNotes: true });
    expect(lines.find((line) => line.key === 'NT-TEST-PROVISOIRE')?.outcome).toBe('BLOQUE');
    expect(lines.find((line) => line.key === 'NT-TEST-DEC')?.outcome).toBe('SUPPRIME');
    expect(lines.find((line) => line.key === 'NT-SCOUT-M03')?.outcome).toBe('PUBLIE');

    // Après publication : questions publiées avec corrigé commenté, plus aucun module bloquant
    // hormis le module provisoire.
    const after = await auditCatalog(prisma);
    expect(after.summary.blockingModules).toBe(1);
    const methode = after.modules.find((entry) => entry.sourceKey === 'NT-SCOUT-M03')!;
    expect(methode).toMatchObject({ published: true, classification: 'F' });
    expect(methode.quiz.source).toBe('BASE');
    const guidance = await prisma.evaluationQuestion.findFirstOrThrow({
      where: {
        version: {
          evaluation: {
            moduleId: (
              await prisma.moduleSourceImport.findUniqueOrThrow({
                where: { sourceKey: 'NT-SCOUT-M03' },
              })
            ).moduleId,
          },
        },
      },
      orderBy: { position: 'asc' },
    });
    expect(guidance.guidance).toMatch(/^Leçon 1 « Présentation des huit éléments » — difficulté/);
  });
});
