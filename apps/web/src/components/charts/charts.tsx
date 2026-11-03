'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from 'recharts';
import { usePrefersReducedMotion } from './chart-card';

// Graphiques Recharts aux couleurs du thème (jetons `--chart-*` de globals.css, ordre fixe).
// Marques fines, grille discrète, valeurs en clair ; chaque graphique est accompagné du tableau
// de ses valeurs (`ChartCard`).

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 13,
};

/** Libellé de catégorie sur une seule ligne (Recharts replie sinon selon sa propre mesure). */
function CategoryTick({ x, y, payload }: YAxisTickContentProps) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
      {String(payload?.value ?? '')}
    </text>
  );
}

export interface CategoryDatum {
  label: string;
  value: number;
}

/**
 * Barres horizontales d'une seule série (libellés longs lisibles sur mobile) ; valeur inscrite en
 * bout de barre, donc pas de légende.
 */
export function CategoryBarChart({
  data,
  valueLabel,
}: {
  data: readonly CategoryDatum[];
  /** Nom de la mesure dans l'infobulle (« Routiers actifs »). */
  valueLabel: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Largeur des libellés estimée (police de 12 px) : un libellé n'est jamais coupé ni replié.
  const labelWidth = Math.min(
    180,
    Math.max(72, ...data.map((datum) => Math.ceil(datum.label.length * 7.6) + 16)),
  );
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 16}>
      <BarChart
        data={[...data]}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tick={CategoryTick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [value, valueLabel]}
        />
        <Bar
          dataKey="value"
          name={valueLabel}
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          barSize={18}
          isAnimationActive={!reducedMotion}
        >
          <LabelList
            dataKey="value"
            position="right"
            className="tabular-nums"
            fill="var(--foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface Series {
  key: string;
  label: string;
}

/** Évolution de plusieurs séries (au plus trois, couleurs `--chart-1` à `--chart-3`). */
export function SeriesLineChart({
  data,
  xKey,
  series,
  formatX,
}: {
  data: readonly Record<string, string | number>[];
  xKey: string;
  series: readonly Series[];
  formatX: (value: string) => string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={[...data]} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey={xKey}
          tickFormatter={(value: string) => formatX(value)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(value) => formatX(String(value))}
          cursor={{ stroke: 'var(--border)' }}
        />
        {/* Légende dans l'ordre des séries (et non alphabétique). */}
        <Legend iconType="plainline" itemSorter={null} wrapperStyle={{ fontSize: 13 }} />
        {series.map((item, index) => (
          <Line
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stroke={`var(--chart-${index + 1})`}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={!reducedMotion}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
