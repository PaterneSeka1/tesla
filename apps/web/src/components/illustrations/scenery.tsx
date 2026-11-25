/**
 * Bibliothèque graphique Tesla (D205) : éléments vectoriels originaux et symboliques (savane,
 * camp, sentier), dessinés en SVG avec les couleurs du thème, sans image ni dépendance. Ils
 * s'assemblent dans des scènes (carte d'aventure, salle des défis, états vides) et sont toujours
 * décoratifs (`aria-hidden`) : aucun lieu réel ni information pédagogique n'y est représenté.
 * Chaque élément est dessiné autour de son pied (x = 0, y = 0) ; `scale` règle sa taille.
 */
type Piece = { x: number; y: number; scale?: number; opacity?: number };

const at = ({ x, y, scale = 1 }: Piece) => `translate(${x} ${y}) scale(${scale})`;

/** Baobab : tronc large, branches courtes. */
export function Baobab(props: Piece) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 0.75} fill="var(--tesla-bordeaux)">
      <path d="M-5 0 C-4 -12 -6 -22 -7 -30 H7 C6 -22 4 -12 5 0Z" />
      <path
        d="M-7 -29 C-12 -34 -16 -35 -20 -34 M7 -29 C11 -35 16 -37 20 -35 M0 -30 V-40 M-3 -31 L-9 -40 M3 -31 L9 -41"
        stroke="var(--tesla-bordeaux)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="-19" cy="-36" rx="6" ry="3" opacity="0.8" />
      <ellipse cx="19" cy="-37" rx="7" ry="3.2" opacity="0.8" />
      <ellipse cx="0" cy="-42" rx="6" ry="3" opacity="0.8" />
    </g>
  );
}

/** Acacia : couronne plate. */
export function Acacia(props: Piece) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 0.5} fill="var(--tesla-bordeaux)">
      <path d="M-1.2 0 L-0.6 -16 H0.6 L1.2 0Z" />
      <path d="M0 -14 L-6 -19 M0 -14 L7 -20" stroke="var(--tesla-bordeaux)" strokeWidth="1.4" />
      <ellipse cx="0" cy="-21" rx="16" ry="4.2" />
    </g>
  );
}

/** Tente de camp. */
export function Tent(props: Piece) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 0.7}>
      <path d="M-14 0 L0 -20 L14 0Z" fill="var(--tesla-rouge)" />
      <path d="M0 -20 L-3 0 H3Z" fill="var(--tesla-sable)" />
      <path d="M0 -20 V-24" stroke="var(--tesla-bordeaux)" strokeWidth="1.4" />
    </g>
  );
}

/** Feu de camp : bûches croisées, flamme. */
export function Campfire(props: Piece) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 0.8}>
      <path
        d="M-8 0 L8 -4 M-8 -4 L8 0"
        stroke="var(--tesla-bordeaux)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M0 -4 C-6 -8 -3 -14 0 -18 C1 -13 6 -11 3 -5 C2 -8 0 -8 0 -4Z"
        fill="var(--tesla-or)"
      />
    </g>
  );
}

/** Rose des vents. */
export function Compass(props: Piece) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 0.45}>
      <circle r="11" fill="none" stroke="var(--tesla-bordeaux)" strokeWidth="1.2" />
      <path d="M0 -14 L3 0 L0 14 L-3 0Z" fill="var(--tesla-rouge)" />
      <path d="M-14 0 L0 -3 L14 0 L0 3Z" fill="var(--tesla-bordeaux)" opacity="0.6" />
    </g>
  );
}

/** Fanion d'arrivée. */
export function Pennant({ color = 'var(--tesla-rouge)', ...props }: Piece & { color?: string }) {
  return (
    <g transform={at(props)} opacity={props.opacity ?? 1}>
      <path d="M0 0 V-26" stroke="var(--tesla-bordeaux)" strokeWidth="2" strokeLinecap="round" />
      <path d="M1 -26 L16 -21 L1 -15Z" fill={color} />
    </g>
  );
}

/** Touffe d'herbe sèche. */
export function Grass(props: Piece) {
  return (
    <path
      transform={at(props)}
      opacity={props.opacity ?? 0.5}
      d="M-6 0 Q-5 -6 -8 -9 M0 0 Q0 -8 -1 -12 M6 0 Q5 -6 8 -9"
      stroke="var(--tesla-bordeaux)"
      strokeWidth="1.4"
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** Ensembles décoratifs proposés par thème (choix stable par module). */
export const SCENERY_THEMES = {
  savane: [Baobab, Acacia, Grass, Acacia],
  camp: [Tent, Campfire, Acacia, Grass],
  piste: [Compass, Acacia, Grass, Baobab],
} as const;
export type SceneryTheme = keyof typeof SCENERY_THEMES;

/** Thème stable d'une scène à partir d'un identifiant (slug de module, clé de jeu). */
export function themeFor(seed: string): SceneryTheme {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const themes = Object.keys(SCENERY_THEMES) as SceneryTheme[];
  return themes[hash % themes.length]!;
}
