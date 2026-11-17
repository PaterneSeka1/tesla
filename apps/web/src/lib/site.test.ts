import { describe, expect, it } from 'vitest';
import { NAVIGATION } from './navigation';
import {
  buildRobots,
  buildSitemap,
  buildStructuredData,
  INDEXABLE_PATHS,
  PRIVATE_PATH_PREFIXES,
  resolveSiteUrl,
  serializeJsonLd,
} from './site';

const site = new URL('https://exemple.test');

describe('resolveSiteUrl', () => {
  it('retient l’origine d’une URL valide', () => {
    expect(resolveSiteUrl('https://tesla.exemple.org/chemin?x=1').href).toBe(
      'https://tesla.exemple.org/',
    );
  });

  it('revient au domaine public si la valeur est absente ou invalide', () => {
    for (const raw of [undefined, '', '  ', 'pas une url', 'ftp://exemple.test']) {
      expect(resolveSiteUrl(raw).href).toBe('https://nikola-tesla-academie.vercel.app/');
    }
  });
});

describe('robots et plan du site', () => {
  it('n’expose au plan du site que les pages publiques', () => {
    expect(buildSitemap(site).map((entry) => entry.url)).toEqual([
      'https://exemple.test/',
      'https://exemple.test/connexion',
    ]);
  });

  it('interdit l’exploration de l’API et de toute page connectée', () => {
    const robots = buildRobots(site);
    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rules?.disallow).toEqual([...PRIVATE_PATH_PREFIXES]);
    expect(robots.sitemap).toBe('https://exemple.test/sitemap.xml');

    for (const path of NAVIGATION.flatMap((group) => group.items.map((item) => item.href))) {
      expect(
        PRIVATE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)),
        `${path} doit être exclu de robots.txt`,
      ).toBe(true);
    }
  });

  it('n’ouvre jamais une page privée à l’indexation', () => {
    for (const path of INDEXABLE_PATHS) {
      expect(PRIVATE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))).toBe(false);
    }
  });
});

describe('données structurées', () => {
  it('décrivent le site et la communauté en URL absolues', () => {
    const data = buildStructuredData(site);
    expect(data['@graph'].map((node) => node['@type'])).toEqual([
      'EducationalOrganization',
      'WebSite',
    ]);
    expect(data['@graph'][0]).toMatchObject({
      logo: 'https://exemple.test/brand/logo-communaute.png',
    });
  });

  it('ne peuvent pas fermer la balise script', () => {
    expect(serializeJsonLd({ a: '</script><script>' })).not.toContain('</script>');
  });
});
