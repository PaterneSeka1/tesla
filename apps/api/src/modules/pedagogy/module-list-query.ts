import { type editorModuleListQuerySchema, WORKING_MODULE_STATUSES } from '@tesla/shared';
import { type z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { type ModuleVersionStatus } from '../../generated/prisma/enums.js';

// Liste « Tous les modules » (D171) : chaque filtre devient une condition de la requête ; la
// pagination et les compteurs portent sur les modules, jamais sur les versions.

type ParsedQuery = z.output<typeof editorModuleListQuerySchema>;
type Where = Prisma.PedagogicalModuleWhereInput;

const working: ModuleVersionStatus[] = [...WORKING_MODULE_STATUSES];
/** Versions « affichées » d'un module : sa version de travail et sa version publiée. */
const active: ModuleVersionStatus[] = [...working, 'PUBLIE'];

export interface ListContext {
  userId: string;
  /** Le responsable plein décide (filtre « nécessitant mon intervention »). */
  canReview: boolean;
}

/**
 * Condition portée par la version affichée du module : version de travail ou publiée, à défaut
 * n'importe laquelle de ses versions (module retiré ou refusé).
 */
function onShownVersion(condition: Prisma.ModuleVersionWhereInput): Where {
  return {
    OR: [
      { versions: { some: { status: { in: active }, ...condition } } },
      { versions: { none: { status: { in: active } } }, AND: { versions: { some: condition } } },
    ],
  };
}

function statusWhere(status: ParsedQuery['status']): Where | null {
  switch (status) {
    case 'all':
      return null;
    case 'working':
      return { versions: { some: { status: { in: working } } } };
    case 'PUBLIE':
    case 'published':
      return { publishedVersionId: { not: null } };
    case 'REFUSE':
    case 'ARCHIVE':
      // Module sans version de travail ni publiée dont une version porte cet état.
      return {
        publishedVersionId: null,
        versions: { none: { status: { in: working } }, some: { status } },
      };
    default:
      return { versions: { some: { status } } };
  }
}

function publicationWhere(publication: ParsedQuery['publication']): Where | null {
  switch (publication) {
    case 'current':
      return { publishedVersionId: { not: null } };
    case 'never':
      return { versions: { none: { publishedAt: { not: null } } } };
    case 'withdrawn':
      return { publishedVersionId: null, versions: { some: { publishedAt: { not: null } } } };
    case 'with_working':
      return {
        publishedVersionId: { not: null },
        versions: { some: { status: { in: working } } },
      };
    default:
      return null;
  }
}

/** Début de journée UTC ; `endOfDay` = début du lendemain (borne exclue). */
function day(value: string, endOfDay = false): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** Conditions des filtres (hors périmètre d'accès et recherche textuelle). */
export function moduleFilterWhere(query: ParsedQuery, context: ListContext): Where[] {
  const filters: Where[] = [];
  const push = (where: Where | null) => where && filters.push(where);
  push(statusWhere(query.status));
  push(publicationWhere(query.publication));
  if (query.stageId) push(onShownVersion({ stageId: query.stageId }));
  if (query.category) push(onShownVersion({ category: query.category }));
  if (query.author) push({ createdById: query.author === 'me' ? context.userId : query.author });
  switch (query.collaboration) {
    case 'mine':
      push({ createdById: context.userId });
      break;
    case 'collaborating':
      push({ collaborators: { some: { userId: context.userId, removedAt: null } } });
      break;
    case 'action':
      // Responsable : versions à décider ou à publier ; chef : corrections demandées.
      push({
        versions: {
          some: { status: { in: context.canReview ? ['SOUMIS', 'APPROUVE'] : ['A_CORRIGER'] } },
        },
      });
      break;
  }
  if (query.origin === 'import') push({ sourceImport: { isNot: null } });
  if (query.origin === 'manual') push({ sourceImport: { is: null } });
  if (query.evaluation === 'with') push({ evaluations: { some: {} } });
  if (query.evaluation === 'without') push({ evaluations: { none: {} } });
  if (query.evaluation === 'published') {
    push({ evaluations: { some: { publishedVersionId: { not: null } } } });
  }
  if (query.lessons) {
    const withLessons = onShownVersion({ lessons: { some: {} } });
    push(query.lessons === 'with' ? withLessons : { NOT: withLessons });
  }
  if (query.from || query.to) {
    const range: Prisma.DateTimeFilter = {};
    if (query.from) range.gte = day(query.from);
    if (query.to) range.lt = day(query.to, true);
    push(query.dateField === 'created' ? { createdAt: range } : { updatedAt: range });
  }
  return filters;
}

/** Tri Prisma (hors titre) avec départage stable par numéro de module. */
export function moduleOrderBy(
  sort: ParsedQuery['sort'],
): Prisma.PedagogicalModuleOrderByWithRelationInput[] | null {
  switch (sort) {
    case 'updated_desc':
      return [{ updatedAt: 'desc' }, { number: 'desc' }];
    case 'updated_asc':
      return [{ updatedAt: 'asc' }, { number: 'asc' }];
    case 'created_desc':
      return [{ createdAt: 'desc' }, { number: 'desc' }];
    case 'created_asc':
      return [{ createdAt: 'asc' }, { number: 'asc' }];
    case 'code_asc':
      return [{ number: 'asc' }];
    case 'code_desc':
      return [{ number: 'desc' }];
    default:
      return null; // titre : tri SQL sur la version affichée
  }
}

// ─── Recherche insensible à la casse et aux accents ───────────────────────

const ACCENTED = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
const PLAIN = 'aaaaaaceeeeiiiinooooouuuuyy';

/** Forme repliée (minuscules, sans diacritiques) : identique côté SQL (`fold`). */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function fold(expression: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`translate(lower(${expression}), ${ACCENTED}, ${PLAIN})`;
}

/** Motif `LIKE` : jokers de l'utilisateur neutralisés. */
export function likePattern(search: string): string {
  return `%${foldText(search).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const workingSql = Prisma.join(
  working.map((status) => Prisma.sql`${status}::"ModuleVersionStatus"`),
);
const activeSql = Prisma.join(active.map((status) => Prisma.sql`${status}::"ModuleVersionStatus"`));

/**
 * Identifiants des modules correspondant à la recherche : code (« MOD-012 », « 12 »), titre, résumé
 * et thème de la version affichée, nom de l'auteur. Le périmètre d'accès est appliqué ensuite.
 */
export function moduleSearchSql(search: string): Prisma.Sql {
  const pattern = likePattern(search);
  const digits = /^(?:mod[-\s]?)?0*(\d{1,9})$/i.exec(search.trim());
  const byNumber = digits ? Prisma.sql`m.number = ${Number(digits[1])} OR` : Prisma.empty;
  return Prisma.sql`
    SELECT m.id FROM pedagogical_modules m
    LEFT JOIN users u ON u.id = m.created_by_id
    WHERE ${byNumber}
      ${fold(Prisma.sql`'mod-' || lpad(m.number::text, 3, '0')`)} LIKE ${pattern}
      OR ${fold(Prisma.sql`coalesce(u.first_name || ' ' || u.last_name, '')`)} LIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM module_versions v
        WHERE v.module_id = m.id
          AND (v.status IN (${activeSql}) OR NOT EXISTS (
            SELECT 1 FROM module_versions a WHERE a.module_id = m.id AND a.status IN (${activeSql})))
          AND (${fold(Prisma.sql`v.title`)} LIKE ${pattern}
            OR ${fold(Prisma.sql`v.summary`)} LIKE ${pattern}
            OR ${fold(Prisma.sql`coalesce(v.theme, '')`)} LIKE ${pattern}))`;
}

/**
 * Page d'identifiants triés par titre de la version affichée (travail, sinon publiée, sinon la plus
 * récente), départagés par numéro, parmi les modules déjà filtrés. Ordre alphabétique français
 * (collation ICU `fr-x-icu`, fournie par PostgreSQL compilé avec ICU, défaut depuis la version 16) :
 * accents et casse secondaires, apostrophe « ’ » avant les lettres, comme `localeCompare('fr')`.
 */
export function moduleTitlePageSql(
  ids: string[],
  direction: 'asc' | 'desc',
  skip: number,
  take: number,
): Prisma.Sql {
  const order = direction === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC');
  return Prisma.sql`
    SELECT m.id FROM pedagogical_modules m
    CROSS JOIN LATERAL (
      SELECT v.title FROM module_versions v WHERE v.module_id = m.id
      ORDER BY (v.status IN (${workingSql})) DESC, (v.id = m.published_version_id) DESC, v.version DESC
      LIMIT 1) shown
    WHERE m.id = ANY(${ids}::uuid[])
    ORDER BY shown.title COLLATE "fr-x-icu" ${order}, m.number ASC
    LIMIT ${take} OFFSET ${skip}`;
}
