/**
 * Vérificateur pédagogique du catalogue (`npm run pedagogy:audit`).
 *
 * Lit la base (aucune écriture) et contrôle chaque module : leçons vides ou provisoires, leçons trop
 * minces, objectifs, références, notes éditoriales en attente, classement, questionnaires (définition
 * du catalogue et questionnaires en base), ressources, cohérence des versions publiées, modules
 * proches. Chaque anomalie relève d'une famille — contenu, source, paramétrage, validation humaine —
 * et peut être bloquante. Chaque module reçoit une catégorie :
 *
 * - A à compléter (contenu manquant) ; B à consolider (anomalie non bloquante) ;
 * - C à fusionner (brouillon vide dont le sujet est couvert ailleurs) ; D à archiver (brouillon vide) ;
 * - E prêt pour validation (aucune anomalie bloquante, décision du responsable attendue) ;
 * - F publiable ou publié (approuvé ou publié, sans anomalie bloquante).
 *
 * Les règles de questionnaire servent aussi aux tests des définitions (`auditQuizQuestions`).
 */
import {
  ACTION_DOMAINS,
  ACTION_DOMAINS_MODULE_KEY,
  createQuestionInputSchema,
  type LessonDocument,
  pendingEditorialNotes,
  type SourceEditorialNote,
} from '@tesla/shared';
import { type PrismaClient } from '../../src/generated/prisma/client.js';
import { quizQuestionInput, ROUTE_QUIZZES } from './route-questionnaires.js';

export type IssueFamily = 'CONTENU' | 'SOURCE' | 'PARAMETRAGE' | 'VALIDATION_HUMAINE';
export type ModuleClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface AuditIssue {
  code: string;
  family: IssueFamily;
  blocking: boolean;
  message: string;
}

export interface ModuleAudit {
  code: string;
  sourceKey: string | null;
  title: string;
  category: string | null;
  stage: string | null;
  status: string;
  version: number;
  published: boolean;
  author: string;
  lessons: number;
  emptyLessons: number;
  pendingNotes: number;
  quiz: { source: 'BASE' | 'DEFINITION' | 'AUCUN'; questions: number };
  similarTo: string[];
  classification: ModuleClass;
  /** Destiné aux routiers : publié, en cours d'approbation, ou brouillon avec contenu. */
  intendedForPublication: boolean;
  issues: AuditIssue[];
}

export interface AuditReport {
  generatedAt: string;
  modules: ModuleAudit[];
  summary: {
    modules: number;
    published: number;
    drafts: number;
    archived: number;
    emptyLessons: number;
    modulesWithoutQuiz: number;
    blockingNotes: number;
    questionsInBase: number;
    questionsDefined: number;
    awaitingHumanValidation: number;
    byClass: Record<ModuleClass, number>;
    blockingModules: number;
  };
}

// ─── Leçons ───────────────────────────────────────────────────────────────

/** Texte provisoire interdit dans un cours publiable. */
const PLACEHOLDER =
  /(contenu à venir|à compléter|bientôt disponible|texte en préparation|insérer le cours|à rédiger|lorem ipsum|\bTODO\b|\bTBD\b)/i;
/** Lignes de référence en fin de leçon. */
const REFERENCE = /^(Source|Référence)\s?:/;
/** Seuil sous lequel une leçon est jugée trop mince (mots, hors références). */
export const THIN_LESSON_WORDS = 40;

function blocksOf(doc: LessonDocument): string[] {
  const out: string[] = [];
  const walk = (node: unknown): string => {
    const n = node as { type: string; text?: string; content?: unknown[] };
    if (n.type === 'text') return n.text ?? '';
    return (n.content ?? []).map(walk).join(n.type === 'paragraph' ? '' : '\n');
  };
  for (const block of doc.content ?? []) out.push(walk(block).trim());
  return out.filter(Boolean);
}

/** Anomalies d'une leçon (contenu et source). `requireReference` : modules du catalogue. */
export function auditLesson(
  title: string,
  content: LessonDocument,
  options: { requireReference: boolean; fundamental: boolean },
): AuditIssue[] {
  const label = `leçon « ${title} »`;
  const blocks = blocksOf(content);
  const hasImage = JSON.stringify(content).includes('"image"');
  if (blocks.length === 0 && !hasImage) {
    return [{ code: 'LECON_VIDE', family: 'CONTENU', blocking: true, message: `${label} vide` }];
  }
  const issues: AuditIssue[] = [];
  const text = blocks.join('\n');
  if (PLACEHOLDER.test(text) || PLACEHOLDER.test(title)) {
    issues.push({
      code: 'TEXTE_PROVISOIRE',
      family: 'CONTENU',
      blocking: true,
      message: `${label} : texte provisoire (« ${text.match(PLACEHOLDER)?.[0] ?? title} »)`,
    });
  }
  const paragraphs = blocks.filter((b) => b.length >= 40).map((b) => b.toLowerCase());
  if (new Set(paragraphs).size !== paragraphs.length) {
    issues.push({
      code: 'PARAGRAPHE_REPETE',
      family: 'CONTENU',
      blocking: true,
      message: `${label} : paragraphe répété`,
    });
  }
  const body = blocks.filter((b) => !REFERENCE.test(b));
  const words = body.join(' ').split(/\s+/).filter(Boolean).length;
  if (!options.fundamental && words < THIN_LESSON_WORDS) {
    issues.push({
      code: 'LECON_MINCE',
      family: 'CONTENU',
      blocking: false,
      message: `${label} : ${words} mots, développement à étoffer`,
    });
  }
  if (options.requireReference && !options.fundamental && !blocks.some((b) => REFERENCE.test(b))) {
    issues.push({
      code: 'REFERENCE_MANQUANTE',
      family: 'SOURCE',
      blocking: true,
      message: `${label} : aucune référence documentaire`,
    });
  }
  return issues;
}

// ─── Questionnaires ───────────────────────────────────────────────────────

export interface AuditedQuestion {
  type: string;
  prompt: string;
  options: { label: string; isCorrect: boolean }[];
  acceptedAnswers: string[];
  /** Leçon de référence (définitions du catalogue) ; null si inconnue. */
  lesson: number | null;
}

const normalized = (value: string) => value.normalize('NFC').trim().toLowerCase();

/** Règles d'un questionnaire : nombre, cohérence du corrigé, doublons, renvois aux leçons. */
export function auditQuizQuestions(
  questions: readonly AuditedQuestion[],
  lessonCount: number,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (code: string, message: string, blocking = true) =>
    issues.push({ code, family: 'PARAMETRAGE', blocking, message });
  if (questions.length < 4) add('QUESTIONNAIRE_INCOMPLET', `${questions.length} question(s)`);
  const prompts = questions.map((question) => normalized(question.prompt));
  const repeated = prompts.filter((prompt, index) => prompts.indexOf(prompt) !== index);
  for (const prompt of new Set(repeated))
    add('QUESTION_REPETEE', `question répétée : « ${prompt} »`);
  questions.forEach((question, index) => {
    const label = `question ${index + 1}`;
    const correct = question.options.filter((option) => option.isCorrect).length;
    const labels = question.options.map((option) => normalized(option.label));
    if (new Set(labels).size !== labels.length)
      add('REPONSES_IDENTIQUES', `${label} : propositions identiques`);
    switch (question.type) {
      case 'CHOIX_UNIQUE':
        if (question.options.length < 2 || correct !== 1) {
          add('CORRIGE_INVALIDE', `${label} : un choix unique exige exactement une bonne réponse`);
        }
        break;
      case 'CHOIX_MULTIPLE':
        if (correct < 1) add('CORRIGE_INVALIDE', `${label} : aucune bonne réponse`);
        if (correct === question.options.length) {
          add('CORRIGE_INVALIDE', `${label} : toutes les propositions sont justes`);
        }
        break;
      case 'VRAI_FAUX':
        if (question.options.length !== 2 || correct !== 1) {
          add('CORRIGE_INVALIDE', `${label} : vrai/faux incohérent`);
        }
        break;
      case 'REPONSE_COURTE':
        if (question.acceptedAnswers.length === 0) {
          add('CORRECTION_HUMAINE', `${label} : réponse courte sans variante acceptée`, false);
        }
        break;
      default:
        add('CORRECTION_HUMAINE', `${label} : correction humaine requise`, false);
    }
    if (question.lesson !== null && (question.lesson < 1 || question.lesson > lessonCount)) {
      add('RENVOI_LECON_INVALIDE', `${label} : renvoie à la leçon ${question.lesson} (absente)`);
    }
  });
  return issues;
}

/** Questions d'une définition du catalogue, validées par le même schéma que l'API. */
export function definitionQuestions(
  moduleKey: string,
  lessonTitles: readonly string[],
): { questions: AuditedQuestion[]; issues: AuditIssue[] } | null {
  const quiz = ROUTE_QUIZZES.find((entry) => entry.moduleKey === moduleKey);
  if (!quiz) return null;
  const issues: AuditIssue[] = [];
  const questions = quiz.questions.map((item, index) => {
    if (item.lesson >= 1 && item.lesson <= lessonTitles.length) {
      const parsed = createQuestionInputSchema.safeParse({
        ...quizQuestionInput(item, lessonTitles),
        versionId: '00000000-0000-7000-8000-000000000000',
      });
      if (!parsed.success) {
        issues.push({
          code: 'QUESTION_INVALIDE',
          family: 'PARAMETRAGE',
          blocking: true,
          message: `question ${index + 1} refusée par le schéma : ${parsed.error.issues[0]?.message}`,
        });
      }
    }
    return {
      type: item.question.type,
      prompt: item.question.prompt,
      options: item.question.options ?? [],
      acceptedAnswers: item.question.acceptedAnswers ?? [],
      lesson: item.lesson,
    };
  });
  return { questions, issues: [...issues, ...auditQuizQuestions(questions, lessonTitles.length)] };
}

// ─── Modules proches ──────────────────────────────────────────────────────

const STOP = new Set([
  'de',
  'la',
  'le',
  'les',
  'des',
  'du',
  'et',
  'en',
  'à',
  'au',
  'aux',
  'l',
  'd',
  'un',
  'une',
  'sa',
  'son',
]);
const tokens = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP.has(word)),
  );

/** Similarité de deux titres (Jaccard sur les mots significatifs). */
export function titleSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  const common = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : common / union;
}

// ─── Audit de la base ─────────────────────────────────────────────────────

const WORKING = ['BROUILLON', 'SOUMIS', 'A_CORRIGER', 'APPROUVE'];

/** Vérifie une URL externe (option `--liens`) ; réseau indisponible = anomalie non bloquante. */
async function linkIssue(url: string, label: string): Promise<AuditIssue | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    return response.ok
      ? null
      : {
          code: 'LIEN_CASSE',
          family: 'SOURCE',
          blocking: false,
          message: `${label} : ${url} répond ${response.status}`,
        };
  } catch {
    return {
      code: 'LIEN_INJOIGNABLE',
      family: 'SOURCE',
      blocking: false,
      message: `${label} : ${url} injoignable`,
    };
  }
}

const normalizedTitle = (title: string) => title.trim().toLocaleLowerCase('fr');
const DOMAIN_TITLES = new Set(ACTION_DOMAINS.map(normalizedTitle));

/**
 * Domaines d'action : le module de référence contient exactement les dix domaines, une leçon chacun,
 * dans l'ordre du référentiel ; un autre module rédigé qui porte le nom d'un domaine est signalé
 * (les domaines ne sont ni des modules, ni des étapes).
 */
export function auditActionDomains(
  key: string | null,
  title: string,
  lessonTitles: readonly string[],
  empty: boolean,
): AuditIssue[] {
  if (key === ACTION_DOMAINS_MODULE_KEY) {
    const exact =
      lessonTitles.length === ACTION_DOMAINS.length &&
      lessonTitles.every((lesson, index) => lesson === ACTION_DOMAINS[index]);
    return exact
      ? []
      : [
          {
            code: 'DOMAINES_ACTION',
            family: 'CONTENU',
            blocking: true,
            message: `le module des domaines d’action doit contenir exactement les ${ACTION_DOMAINS.length} domaines du référentiel, une leçon chacun (${lessonTitles.length} leçon(s))`,
          },
        ];
  }
  if (!empty && DOMAIN_TITLES.has(normalizedTitle(title))) {
    return [
      {
        code: 'DOMAINE_EN_DOUBLE',
        family: 'PARAMETRAGE',
        blocking: false,
        message: `porte le nom d’un domaine d’action : les domaines sont traités dans ${ACTION_DOMAINS_MODULE_KEY}`,
      },
    ];
  }
  return [];
}

export async function auditCatalog(
  prisma: PrismaClient,
  options: { checkLinks?: boolean } = {},
): Promise<AuditReport> {
  const modules = await prisma.pedagogicalModule.findMany({
    orderBy: { number: 'asc' },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      sourceImport: { select: { sourceKey: true, editorialNotes: true } },
      sourceRevisions: { orderBy: { revision: 'desc' }, take: 1, select: { editorialNotes: true } },
      versions: {
        orderBy: { version: 'desc' },
        include: {
          stage: { select: { name: true } },
          lessons: { orderBy: { position: 'asc' } },
          resources: { include: { file: { select: { status: true } } } },
        },
      },
      evaluations: {
        include: {
          publishedVersion: {
            include: {
              questionItems: { include: { options: true }, orderBy: { position: 'asc' } },
            },
          },
          versions: { select: { status: true } },
        },
      },
    },
  });

  const audits: ModuleAudit[] = [];
  for (const module of modules) {
    const working = module.versions.find((version) => WORKING.includes(version.status));
    const published = module.versions.find((version) => version.id === module.publishedVersionId);
    const target = working ?? published ?? module.versions[0]!;
    const key = module.sourceImport?.sourceKey ?? null;
    const fundamental = target.category === 'TEXTE_FONDAMENTAL';
    const issues: AuditIssue[] = [];
    const lessonTitles = target.lessons.map((lesson) => lesson.title);

    // Contenu et source des leçons.
    let emptyLessons = 0;
    for (const lesson of target.lessons) {
      const found = auditLesson(lesson.title, lesson.content as unknown as LessonDocument, {
        requireReference: key !== null,
        fundamental,
      });
      if (found.some((issue) => issue.code === 'LECON_VIDE')) emptyLessons += 1;
      issues.push(...found);
    }
    const allEmpty = target.lessons.length === 0 || emptyLessons === target.lessons.length;
    if (target.lessons.length === 0) {
      issues.push({
        code: 'SANS_LECON',
        family: 'CONTENU',
        blocking: true,
        message: 'aucune leçon',
      });
    }
    if (!fundamental && target.objectives.length === 0) {
      issues.push({
        code: 'SANS_OBJECTIF',
        family: 'CONTENU',
        blocking: true,
        message: 'aucun objectif',
      });
    }

    // Domaines d'action (D158) : exactement dix, dans le seul module de référence.
    issues.push(...auditActionDomains(key, target.title, lessonTitles, allEmpty));

    // Paramétrage.
    if (target.category === null) {
      issues.push({
        code: 'NON_CLASSE',
        family: 'PARAMETRAGE',
        blocking: true,
        message: 'catégorie « à classer »',
      });
    }
    if (target.category === 'ETAPE' && !target.stageId) {
      issues.push({
        code: 'ETAPE_MANQUANTE',
        family: 'PARAMETRAGE',
        blocking: true,
        message: 'module d’étape sans étape',
      });
    }
    if (target.obligation === 'OBLIGATOIRE' && !target.officialSource) {
      issues.push({
        code: 'OBLIGATOIRE_SANS_SOURCE',
        family: 'SOURCE',
        blocking: true,
        message: 'module obligatoire sans référence officielle validée',
      });
    }
    for (const resource of target.resources) {
      if (resource.file && resource.file.status !== 'VALIDE') {
        issues.push({
          code: 'RESSOURCE_INTROUVABLE',
          family: 'SOURCE',
          blocking: true,
          message: `ressource « ${resource.title} » : fichier ${resource.file.status.toLowerCase()}`,
        });
      }
      if (options.checkLinks && resource.url) {
        const issue = await linkIssue(resource.url, `ressource « ${resource.title} »`);
        if (issue) issues.push(issue);
      }
    }
    if (options.checkLinks) {
      for (const lesson of target.lessons) {
        const hrefs = [
          ...JSON.stringify(lesson.content).matchAll(/"(?:href|src)":"(https?:[^"]+)"/g),
        ];
        for (const [, href] of hrefs) {
          const issue = await linkIssue(href!, `leçon « ${lesson.title} »`);
          if (issue) issues.push(issue);
        }
      }
    }
    if (published && published.lessons.length === 0) {
      issues.push({
        code: 'PUBLICATION_INCOHERENTE',
        family: 'PARAMETRAGE',
        blocking: true,
        message: 'version publiée sans leçon',
      });
    }

    // Questionnaire : en base d'abord, sinon définition du catalogue.
    const needsQuiz = target.category === 'ETAPE' || target.category === 'COMPLEMENTAIRE';
    const inBase = module.evaluations.filter((evaluation) => evaluation.publishedVersion);
    let quiz: ModuleAudit['quiz'] = { source: 'AUCUN', questions: 0 };
    if (inBase.length > 0) {
      const version = inBase[0]!.publishedVersion!;
      const questions: AuditedQuestion[] = version.questionItems.map((question) => ({
        type: question.type,
        prompt: question.prompt,
        options: question.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
        acceptedAnswers: question.acceptedAnswers,
        lesson: null,
      }));
      quiz = { source: 'BASE', questions: questions.length };
      issues.push(...auditQuizQuestions(questions, target.lessons.length));
      if (published && version.moduleVersionId && version.moduleVersionId !== published.id) {
        issues.push({
          code: 'QUESTIONNAIRE_VERSION',
          family: 'PARAMETRAGE',
          blocking: false,
          message: 'questionnaire publié sur une version antérieure du module : à relire',
        });
      }
    } else if (key) {
      const definition = definitionQuestions(key, lessonTitles);
      if (definition) {
        quiz = { source: 'DEFINITION', questions: definition.questions.length };
        issues.push(...definition.issues);
      }
    }
    if (needsQuiz && quiz.source === 'AUCUN' && !allEmpty) {
      issues.push({
        code: 'SANS_QUESTIONNAIRE',
        family: 'PARAMETRAGE',
        blocking: true,
        message: 'module d’apprentissage sans questionnaire',
      });
    }

    // Validation humaine.
    const notes = (module.sourceRevisions[0]?.editorialNotes ??
      module.sourceImport?.editorialNotes ??
      []) as unknown as SourceEditorialNote[];
    const pending = !published && !allEmpty ? pendingEditorialNotes(notes) : [];
    for (const item of pending) {
      issues.push({
        code: item.kind === 'A_VERIFIER' ? 'NOTE_A_VERIFIER' : 'NOTE_A_COMPLETER',
        family: 'VALIDATION_HUMAINE',
        blocking: false,
        message: `${item.lessonPosition === null ? 'module' : `leçon ${item.lessonPosition + 1}`} : ${item.note}`,
      });
    }

    const blocking = issues.some((issue) => issue.blocking);
    let classification: ModuleClass;
    if (target.status === 'ARCHIVE' || (allEmpty && !published)) classification = 'D';
    else if (issues.some((i) => i.blocking && i.family === 'CONTENU')) classification = 'A';
    else if (
      blocking ||
      issues.some(
        (i) => !i.blocking && i.family !== 'VALIDATION_HUMAINE' && i.code !== 'CORRECTION_HUMAINE',
      )
    )
      classification = 'B';
    else if (published && !working) classification = 'F';
    else if (target.status === 'APPROUVE') classification = 'F';
    else classification = 'E';

    audits.push({
      code: `MOD-${String(module.number).padStart(3, '0')}`,
      sourceKey: key,
      title: target.title,
      category: target.category,
      stage: target.stage?.name ?? null,
      status: target.status,
      version: target.version,
      published: !!published,
      author: module.createdBy
        ? `${module.createdBy.firstName} ${module.createdBy.lastName}`
        : 'Import système',
      lessons: target.lessons.length,
      emptyLessons,
      pendingNotes: pending.length,
      quiz,
      similarTo: [],
      classification,
      intendedForPublication: classification !== 'D',
      issues,
    });
  }

  // Modules proches : un brouillon vide dont le sujet est couvert par un module rédigé → C.
  for (const audit of audits) {
    audit.similarTo = audits
      .filter((other) => other !== audit && titleSimilarity(audit.title, other.title) >= 0.5)
      .map((other) => `${other.sourceKey ?? other.code} « ${other.title} »`);
    if (audit.classification === 'D' && audit.status !== 'ARCHIVE') {
      const covered = audits.some(
        (other) =>
          other !== audit &&
          other.classification !== 'D' &&
          titleSimilarity(audit.title, other.title) >= 0.5,
      );
      if (covered) audit.classification = 'C';
    }
    audit.intendedForPublication = audit.classification !== 'D' && audit.classification !== 'C';
  }

  const byClass = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 } as Record<ModuleClass, number>;
  for (const audit of audits) byClass[audit.classification] += 1;
  const questionsInBase = await prisma.evaluationQuestion.count({
    where: { version: { status: 'PUBLIE' } },
  });
  return {
    generatedAt: new Date().toISOString(),
    modules: audits,
    summary: {
      modules: audits.length,
      published: audits.filter((a) => a.published).length,
      drafts: audits.filter((a) => a.status === 'BROUILLON').length,
      archived: audits.filter((a) => a.status === 'ARCHIVE').length,
      emptyLessons: audits.reduce((sum, a) => sum + a.emptyLessons, 0),
      modulesWithoutQuiz: audits.filter((a) =>
        a.issues.some((i) => i.code === 'SANS_QUESTIONNAIRE'),
      ).length,
      blockingNotes: audits.reduce((sum, a) => sum + a.pendingNotes, 0),
      questionsInBase,
      questionsDefined: audits
        .filter((a) => a.quiz.source === 'DEFINITION')
        .reduce((sum, a) => sum + a.quiz.questions, 0),
      awaitingHumanValidation: audits.filter((a) => a.classification === 'E').length,
      byClass,
      blockingModules: audits.filter(
        (a) => a.intendedForPublication && a.issues.some((i) => i.blocking),
      ).length,
    },
  };
}

const CLASS_LABELS: Record<ModuleClass, string> = {
  A: 'à compléter',
  B: 'à consolider',
  C: 'à fusionner (brouillon vide couvert ailleurs)',
  D: 'à archiver',
  E: 'prêt pour validation',
  F: 'publiable ou publié',
};
const FAMILY_LABELS: Record<IssueFamily, string> = {
  CONTENU: 'contenu',
  SOURCE: 'source',
  PARAMETRAGE: 'paramétrage',
  VALIDATION_HUMAINE: 'validation humaine',
};

/** Rapport lisible (console). */
export function formatAuditReport(report: AuditReport): string {
  const s = report.summary;
  const lines = [
    `Audit pédagogique — ${report.generatedAt}`,
    '',
    `Modules : ${s.modules} (publiés ${s.published}, brouillons ${s.drafts}, archivés ${s.archived})`,
    `Leçons vides : ${s.emptyLessons} · modules sans questionnaire : ${s.modulesWithoutQuiz}`,
    `Questions publiées en base : ${s.questionsInBase} · questions préparées (définitions) : ${s.questionsDefined}`,
    `Notes à valider par le responsable : ${s.blockingNotes} · modules prêts pour validation : ${s.awaitingHumanValidation}`,
    `Classement : ${(Object.keys(s.byClass) as ModuleClass[]).map((c) => `${c} ${s.byClass[c]}`).join(' · ')}`,
    `Modules destinés à la publication avec anomalie bloquante : ${s.blockingModules}`,
    '',
  ];
  for (const audit of report.modules) {
    lines.push(
      `${audit.classification} — ${audit.code}${audit.sourceKey ? ` (${audit.sourceKey})` : ''} « ${audit.title} » : ${CLASS_LABELS[audit.classification]}`,
    );
    lines.push(
      `    ${audit.category ?? 'à classer'} · ${audit.stage ?? 'sans étape'} · ${audit.status} v${audit.version}${audit.published ? ' · publié' : ''} · ${audit.author} · ${audit.lessons} leçon(s), ${audit.emptyLessons} vide(s) · questionnaire ${audit.quiz.source.toLowerCase()} (${audit.quiz.questions} q.)`,
    );
    if (audit.similarTo.length > 0) lines.push(`    Proche de : ${audit.similarTo.join(', ')}`);
    for (const issue of audit.issues) {
      lines.push(
        `    ${issue.blocking ? '✗' : '·'} [${FAMILY_LABELS[issue.family]}] ${issue.message}`,
      );
    }
  }
  return lines.join('\n');
}
