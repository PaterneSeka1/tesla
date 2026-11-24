import type { MetadataRoute } from 'next';

/**
 * Identité publique du site et règles de référencement.
 *
 * Seules les pages publiques (`INDEXABLE_PATHS`) sont proposées aux moteurs de recherche ; tout le
 * reste (pages connectées, liens à jeton, API) reste `noindex` (valeur par défaut de la racine) et
 * exclu de `robots.txt`. Aucune donnée personnelle n'est jamais exposée au référencement.
 */

/** Domaine public par défaut (D187 : le domaine Vercel reste l'origine visible). */
const DEFAULT_SITE_URL = 'https://nikola-tesla-academie.vercel.app';

/** URL absolue du site, surchargeable par `SITE_URL` au build (domaine personnalisé). */
export function resolveSiteUrl(raw: string | undefined = process.env.SITE_URL): URL {
  const value = raw?.trim();
  if (!value) return new URL(DEFAULT_SITE_URL);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return new URL(DEFAULT_SITE_URL);
    return new URL(url.origin);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = 'Nikola Tesla Académie';
export const SITE_SHORT_NAME = 'Tesla Académie';
export const SITE_DESCRIPTION =
  'Plateforme pédagogique de la Communauté Nikola Tesla, Branche Route d’Abidjan : modules lisibles hors ligne, évaluations et suivi de la progression des routiers.';
export const SITE_KEYWORDS = [
  'Nikola Tesla Académie',
  'Communauté Nikola Tesla',
  'Branche Route',
  'routiers',
  'scoutisme',
  'District Requin de Sable',
  'Abidjan',
  'Côte d’Ivoire',
  'formation scoute',
  'progression',
];

/**
 * Base Open Graph. Next remplace `openGraph` en entier d'un segment à l'autre : une page qui le
 * surcharge doit repartir de cette base. Hors du segment racine, une surcharge fait aussi perdre
 * l'image de partage : ne pas surcharger `openGraph` dans une page imbriquée.
 */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  siteName: SITE_NAME,
  locale: 'fr_CI',
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
} as const;

/** Pages publiques ouvertes à l'indexation. */
export const INDEXABLE_PATHS = ['/', '/connexion'] as const;

/** Préfixes jamais explorés : pages connectées, liens à jeton, page hors ligne, API. */
export const PRIVATE_PATH_PREFIXES = [
  '/api/',
  '/accueil',
  '/communaute',
  '/encadrement',
  '/administration',
  '/modules',
  '/evaluations',
  '/defis',
  '/carnet',
  '/mes-resultats',
  '/progression',
  '/mes-competences',
  '/mes-activites',
  '/mes-rattrapages',
  '/appareil',
  '/compte',
  '/inscription',
  '/activation',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/hors-ligne',
] as const;

export function buildRobots(siteUrl: URL = SITE_URL): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...PRIVATE_PATH_PREFIXES] },
    sitemap: new URL('/sitemap.xml', siteUrl).href,
  };
}

export function buildSitemap(siteUrl: URL = SITE_URL): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => ({
    url: new URL(path, siteUrl).href,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }));
}

/** Données structurées (schema.org) de l'accueil public : site et communauté éditrice. */
export function buildStructuredData(siteUrl: URL = SITE_URL) {
  const organization = {
    '@type': 'EducationalOrganization',
    '@id': new URL('/#communaute', siteUrl).href,
    name: 'Communauté Nikola Tesla',
    description: 'Communauté de la Branche Route, District Requin de Sable.',
    url: siteUrl.href,
    logo: new URL('/brand/logo-communaute.png', siteUrl).href,
    address: { '@type': 'PostalAddress', addressLocality: 'Abidjan', addressCountry: 'CI' },
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'WebSite',
        '@id': new URL('/#site', siteUrl).href,
        name: SITE_NAME,
        alternateName: SITE_SHORT_NAME,
        description: SITE_DESCRIPTION,
        url: siteUrl.href,
        inLanguage: 'fr',
        publisher: { '@id': organization['@id'] },
      },
    ],
  };
}

/** JSON sûr dans une balise `<script>` (aucune fermeture de balise possible). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
