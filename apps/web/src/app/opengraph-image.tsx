import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

/**
 * Image de partage (Open Graph, reprise par X/Twitter), générée au build.
 * `ImageResponse` n'accepte pas les variables CSS : couleurs de marque recopiées de `globals.css`.
 */
export const alt = `${SITE_NAME} — Communauté Nikola Tesla, Branche Route, Abidjan`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BORDEAUX = '#510d12';
const OR = '#d9a45f';

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), 'public/brand/logo-communaute.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '0 80px',
        background: BORDEAUX,
        color: 'white',
      }}
    >
      <img src={logoSrc} width={280} height={280} alt="" style={{ borderRadius: 9999 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 26, letterSpacing: 4, color: OR, textTransform: 'uppercase' }}>
          Branche Route · Abidjan
        </div>
        <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.05 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 30, opacity: 0.85, maxWidth: 640 }}>
          Modules hors ligne, évaluations et progression des routiers.
        </div>
      </div>
    </div>,
    size,
  );
}
