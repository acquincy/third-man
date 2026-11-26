import type {
  MetricDefinition,
  MetricEvaluation,
  MetricFormat,
  PercentileProfile,
  Player,
  RoleBenchmark,
  RoleGroup,
  StatMode,
} from '../types/player';

/**
 * Master catalog of football metrics.
 * Only metrics whose `requiredColumns` all exist in the attached CSV are registered at runtime.
 */
const METRIC_CATALOG: MetricDefinition[] = [
  // Attacking & Output
  {
    id: 'goals',
    label: 'Goals',
    shortLabel: 'Gls',
    description: 'Total goals scored including penalties',
    category: 'attacking',
    requiredColumns: ['Gls'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Gls'] ?? null,
  },
  {
    id: 'npGoals',
    label: 'Non-Penalty Goals',
    shortLabel: 'NPG',
    description: 'Goals scored excluding penalty kicks',
    category: 'attacking',
    requiredColumns: ['G-PK'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['G-PK'] ?? null,
  },
  {
    id: 'assists',
    label: 'Assists',
    shortLabel: 'Ast',
    description: 'Direct goal-creating passes',
    category: 'creation',
    requiredColumns: ['Ast'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Ast'] ?? null,
  },
  {
    id: 'goalContrib',
    label: 'Goals + Assists',
    shortLabel: 'G+A',
    description: 'Combined goals and assists',
    category: 'attacking',
    requiredColumns: ['G+A'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['G+A'] ?? null,
  },
  {
    id: 'npGoalContrib',
    label: 'Non-Pen G+A',
    shortLabel: 'npG+A',
    description: 'Non-penalty goals plus assists',
    category: 'attacking',
    requiredColumns: ['G-PK', 'Ast'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => {
      const gpk = p.metrics['G-PK'];
      const ast = p.metrics['Ast'];
      if (gpk === null || gpk === undefined || ast === null || ast === undefined) return null;
      return gpk + ast;
    },
  },
  // Optional Expected Goals / Assists (auto-enabled if CSV or future Supabase table includes them)
  {
    id: 'xg',
    label: 'Expected Goals (xG)',
    shortLabel: 'xG',
    description: 'Cumulative expected goal value of shots taken',
    category: 'attacking',
    requiredColumns: ['xG'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'decimal1',
    extractTotal: (p) => p.metrics['xG'] ?? null,
  },
  {
    id: 'xa',
    label: 'Expected Assists (xA)',
    shortLabel: 'xA',
    description: 'Expected goal value of assisted shot attempts',
    category: 'creation',
    requiredColumns: ['xA'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'decimal1',
    extractTotal: (p) => p.metrics['xA'] ?? null,
  },
  // Shooting
  {
    id: 'shots',
    label: 'Shots',
    shortLabel: 'Sh',
    description: 'Total shot attempts (excluding penalties)',
    category: 'shooting',
    requiredColumns: ['Sh'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Sh'] ?? null,
  },
  {
    id: 'shotsOnTarget',
    label: 'Shots on Target',
    shortLabel: 'SoT',
    description: 'Shots directed on frame',
    category: 'shooting',
    requiredColumns: ['SoT'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['SoT'] ?? null,
  },
  {
    id: 'sotPct',
    label: 'Shot Accuracy',
    shortLabel: 'SoT%',
    description: 'Percentage of shots placed on target',
    category: 'shooting',
    requiredColumns: ['SoT%'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'percent',
    totalFormat: 'percent',
    extractTotal: (p) => p.metrics['SoT%'] ?? null,
  },
  {
    id: 'goalsPerShot',
    label: 'Goals / Shot',
    shortLabel: 'G/Sh',
    description: 'Shooting conversion efficiency per attempt',
    category: 'shooting',
    requiredColumns: ['G/Sh'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'decimal2',
    totalFormat: 'decimal2',
    extractTotal: (p) => p.metrics['G/Sh'] ?? null,
  },
  {
    id: 'goalsPerSot',
    label: 'Goals / SoT',
    shortLabel: 'G/SoT',
    description: 'Finishing efficiency on shots on target',
    category: 'shooting',
    requiredColumns: ['G/SoT'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'decimal2',
    totalFormat: 'decimal2',
    extractTotal: (p) => p.metrics['G/SoT'] ?? null,
  },
  // Creation & Ball-Winning / Misc
  {
    id: 'crosses',
    label: 'Crosses',
    shortLabel: 'Crs',
    description: 'Deliveries played into the penalty area from wide zones',
    category: 'creation',
    requiredColumns: ['Crs'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Crs'] ?? null,
  },
  {
    id: 'foulsDrawn',
    label: 'Fouls Drawn',
    shortLabel: 'Fld',
    description: 'Free kicks won under pressure',
    category: 'creation',
    requiredColumns: ['Fld'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Fld'] ?? null,
  },
  {
    id: 'tacklesWon',
    label: 'Tackles Won',
    shortLabel: 'TklW',
    description: 'Tackles resulting in team possession recovery',
    category: 'defending',
    requiredColumns: ['TklW'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['TklW'] ?? null,
  },
  {
    id: 'interceptions',
    label: 'Interceptions',
    shortLabel: 'Int',
    description: 'Opposition passes cut out cleanly',
    category: 'defending',
    requiredColumns: ['Int'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Int'] ?? null,
  },
  {
    id: 'tklPlusInt',
    label: 'Tackles + Int',
    shortLabel: 'Tkl+Int',
    description: 'Combined ball recoveries via tackles won and interceptions',
    category: 'defending',
    requiredColumns: ['TklW', 'Int'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => {
      const t = p.metrics['TklW'];
      const i = p.metrics['Int'];
      if (t === null || t === undefined || i === null || i === undefined) return null;
      return t + i;
    },
  },
  {
    id: 'foulsCommitted',
    label: 'Fouls Committed',
    shortLabel: 'Fls',
    description: 'Fouls conceded (lower rate ranks higher)',
    category: 'defending',
    requiredColumns: ['Fls'],
    supportsPer90: true,
    isRate: false,
    lowerIsBetter: true,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Fls'] ?? null,
  },
  // Team Impact & Playing Time
  {
    id: 'plusMinus90',
    label: 'Team GD / 90',
    shortLabel: '+/-90',
    description: 'Net team goal difference per 90 while on the pitch',
    category: 'impact',
    requiredColumns: ['+/-90'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'signed2',
    totalFormat: 'signed2',
    extractTotal: (p) => p.metrics['+/-90'] ?? null,
  },
  {
    id: 'onOff',
    label: 'On-Off Net / 90',
    shortLabel: 'On-Off',
    description: 'Team net goal difference per 90 on pitch minus off pitch',
    category: 'impact',
    requiredColumns: ['On-Off'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'signed2',
    totalFormat: 'signed2',
    extractTotal: (p) => p.metrics['On-Off'] ?? null,
  },
  {
    id: 'ppm',
    label: 'Points / Match',
    shortLabel: 'PPM',
    description: 'Average team points earned in matches played',
    category: 'impact',
    requiredColumns: ['PPM'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'decimal2',
    totalFormat: 'decimal2',
    extractTotal: (p) => p.metrics['PPM'] ?? null,
  },
  {
    id: 'minPct',
    label: 'Squad Min Share',
    shortLabel: 'Min%',
    description: 'Share of total team league minutes played',
    category: 'impact',
    requiredColumns: ['Min%'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'percent',
    totalFormat: 'percent',
    extractTotal: (p) => p.metrics['Min%'] ?? null,
  },
  // Goalkeeping
  {
    id: 'savePct',
    label: 'Save Percentage',
    shortLabel: 'Save%',
    description: 'Proportion of shots on target stopped',
    category: 'goalkeeping',
    requiredColumns: ['Save%'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'percent',
    totalFormat: 'percent',
    extractTotal: (p) => p.metrics['Save%'] ?? null,
  },
  {
    id: 'ga90',
    label: 'Goals Against / 90',
    shortLabel: 'GA90',
    description: 'Goals conceded per 90 minutes (lower ranks higher)',
    category: 'goalkeeping',
    requiredColumns: ['GA90'],
    supportsPer90: false,
    isRate: true,
    lowerIsBetter: true,
    per90Format: 'decimal2',
    totalFormat: 'decimal2',
    extractTotal: (p) => p.metrics['GA90'] ?? null,
  },
  {
    id: 'saves',
    label: 'Saves',
    shortLabel: 'Saves',
    description: 'Shots on target prevented from crossing the line',
    category: 'goalkeeping',
    requiredColumns: ['Saves'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['Saves'] ?? null,
  },
  {
    id: 'cleanSheets',
    label: 'Clean Sheets',
    shortLabel: 'CS',
    description: 'Matches completed without conceding a goal',
    category: 'goalkeeping',
    requiredColumns: ['CS'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['CS'] ?? null,
  },
  {
    id: 'csPct',
    label: 'Clean Sheet %',
    shortLabel: 'CS%',
    description: 'Share of starts ending in a shutout',
    category: 'goalkeeping',
    requiredColumns: ['CS%'],
    supportsPer90: false,
    isRate: true,
    per90Format: 'percent',
    totalFormat: 'percent',
    extractTotal: (p) => p.metrics['CS%'] ?? null,
  },
  {
    id: 'sota',
    label: 'Shots Faced',
    shortLabel: 'SoTA',
    description: 'Shots on target faced by the goalkeeper',
    category: 'goalkeeping',
    requiredColumns: ['SoTA'],
    supportsPer90: true,
    isRate: false,
    per90Format: 'decimal2',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['SoTA'] ?? null,
  },
  {
    id: 'pkSaves',
    label: 'Penalty Saves',
    shortLabel: 'PKsv',
    description: 'Penalty kicks saved',
    category: 'goalkeeping',
    requiredColumns: ['PKsv'],
    supportsPer90: false,
    isRate: false,
    per90Format: 'integer',
    totalFormat: 'integer',
    extractTotal: (p) => p.metrics['PKsv'] ?? null,
  },
];

/**
 * Dynamically registers only metrics whose columns exist in the attached CSV.
 */
export function registerAvailableMetrics(availableColumns: Set<string>): {
  metrics: MetricDefinition[];
  metricsById: Record<string, MetricDefinition>;
} {
  const metrics = METRIC_CATALOG.filter((m) =>
    m.requiredColumns.every((col) => availableColumns.has(col))
  );
  const metricsById: Record<string, MetricDefinition> = {};
  for (const m of metrics) {
    metricsById[m.id] = m;
  }
  return { metrics, metricsById };
}

/**
 * Safe Per-90 calculation: returns (stat / minutes) * 90 only when minutes > 0.
 */
export function computePer90(stat: number | null, minutes: number): number | null {
  if (stat === null || stat === undefined || !Number.isFinite(stat)) return null;
  if (!minutes || minutes <= 0) return null;
  return (stat / minutes) * 90;
}

export function getMetricValue(
  player: Player,
  metric: MetricDefinition,
  mode: StatMode
): number | null {
  const base = metric.extractTotal(player);
  if (base === null || !Number.isFinite(base)) return null;
  if (mode === 'per90' && metric.supportsPer90) {
    if (metric.extractPer90) return metric.extractPer90(player);
    return computePer90(base, player.minutes);
  }
  return base;
}

export function formatMetricValue(
  value: number | null,
  metric: MetricDefinition,
  mode: StatMode
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const fmt: MetricFormat = mode === 'per90' ? metric.per90Format : metric.totalFormat;
  switch (fmt) {
    case 'integer':
      return Math.round(value).toLocaleString('en-US');
    case 'decimal1':
      return value.toFixed(1);
    case 'decimal2':
      return value.toFixed(2);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'signed2':
      return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
    case 'signedInt':
      return `${value > 0 ? '+' : ''}${Math.round(value)}`;
    default:
      return value.toFixed(2);
  }
}

export function getPercentileTier(percentile: number | null): 'elite' | 'average' | 'below' | 'none' {
  if (percentile === null) return 'none';
  if (percentile >= 75) return 'elite';
  if (percentile >= 40) return 'average';
  return 'below';
}

/**
 * Computes positional benchmark distributions for a given role group, minutes threshold, and mode.
 */
export function buildRoleBenchmark(
  allPlayers: Player[],
  roleGroup: RoleGroup,
  minMinutes: number,
  mode: StatMode,
  metrics: MetricDefinition[]
): RoleBenchmark {
  const peers = allPlayers.filter(
    (p) => p.roleGroup === roleGroup && p.minutes >= minMinutes
  );

  const distributions: Record<string, number[]> = {};
  const medians: Record<string, number | null> = {};

  for (const metric of metrics) {
    const vals: number[] = [];
    for (const peer of peers) {
      const v = getMetricValue(peer, metric, mode);
      if (v !== null && Number.isFinite(v)) {
        vals.push(v);
      }
    }
    vals.sort((a, b) => a - b);
    distributions[metric.id] = vals;
    if (vals.length === 0) {
      medians[metric.id] = null;
    } else {
      const mid = Math.floor(vals.length / 2);
      medians[metric.id] =
        vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
    }
  }

  return {
    roleGroup,
    minMinutes,
    mode,
    peerCount: peers.length,
    distributions,
    medians,
  };
}

/**
 * Computes a 0–99 percentile rank for a value against a sorted peer distribution.
 * Handles ties cleanly using midpoint rank and respects lowerIsBetter metrics (e.g., GA90).
 */
export function computePercentileRank(
  value: number | null,
  sortedPeers: number[],
  lowerIsBetter = false
): number | null {
  if (value === null || !Number.isFinite(value) || sortedPeers.length === 0) return null;
  if (sortedPeers.length === 1) return 50;

  let below = 0;
  let equal = 0;
  for (let i = 0; i < sortedPeers.length; i++) {
    const v = sortedPeers[i];
    if (v < value) below++;
    else if (v === value) equal++;
    else break;
  }

  const rawRatio = (below + equal * 0.5) / sortedPeers.length;
  const oriented = lowerIsBetter ? 1 - rawRatio : rawRatio;
  return Math.max(0, Math.min(99, Math.round(oriented * 99)));
}

/**
 * Role-specific ordered metric IDs prioritized for Dossier and Verdict views.
 */
const ROLE_CORE_METRIC_IDS: Record<RoleGroup, string[]> = {
  FWD: [
    'npGoals',
    'goals',
    'npGoalContrib',
    'assists',
    'shots',
    'shotsOnTarget',
    'sotPct',
    'goalsPerShot',
    'foulsDrawn',
    'plusMinus90',
  ],
  'WNG/AM': [
    'npGoalContrib',
    'goals',
    'assists',
    'shots',
    'shotsOnTarget',
    'crosses',
    'foulsDrawn',
    'tklPlusInt',
    'plusMinus90',
    'onOff',
  ],
  MID: [
    'npGoalContrib',
    'assists',
    'goals',
    'shots',
    'crosses',
    'tklPlusInt',
    'tacklesWon',
    'interceptions',
    'foulsDrawn',
    'ppm',
    'onOff',
  ],
  DEF: [
    'tklPlusInt',
    'tacklesWon',
    'interceptions',
    'crosses',
    'plusMinus90',
    'onOff',
    'ppm',
    'foulsCommitted',
    'goalContrib',
    'shots',
  ],
  GK: [
    'savePct',
    'ga90',
    'csPct',
    'cleanSheets',
    'saves',
    'sota',
    'ppm',
    'plusMinus90',
  ],
};

const ROLE_VERDICT_METRIC_IDS: Record<RoleGroup, string[]> = {
  FWD: ['npGoals', 'goals', 'assists', 'npGoalContrib', 'shots', 'shotsOnTarget', 'goalsPerShot', 'plusMinus90'],
  'WNG/AM': ['npGoalContrib', 'goals', 'assists', 'shots', 'crosses', 'foulsDrawn', 'tklPlusInt', 'plusMinus90'],
  MID: ['npGoalContrib', 'assists', 'shots', 'crosses', 'tklPlusInt', 'tacklesWon', 'interceptions', 'ppm'],
  DEF: ['tklPlusInt', 'tacklesWon', 'interceptions', 'crosses', 'plusMinus90', 'onOff', 'ppm', 'foulsCommitted'],
  GK: ['savePct', 'ga90', 'csPct', 'cleanSheets', 'saves', 'sota', 'ppm', 'plusMinus90'],
};

const INDEX_TABLE_METRIC_IDS: Record<RoleGroup | 'ALL', string[]> = {
  ALL: ['goals', 'assists', 'npGoalContrib', 'shots', 'tklPlusInt', 'plusMinus90'],
  FWD: ['goals', 'npGoals', 'assists', 'shots', 'sotPct', 'goalsPerShot'],
  'WNG/AM': ['goals', 'assists', 'npGoalContrib', 'shots', 'crosses', 'foulsDrawn'],
  MID: ['goals', 'assists', 'npGoalContrib', 'crosses', 'tklPlusInt', 'ppm'],
  DEF: ['tklPlusInt', 'tacklesWon', 'interceptions', 'crosses', 'plusMinus90', 'onOff'],
  GK: ['savePct', 'ga90', 'cleanSheets', 'csPct', 'saves', 'ppm'],
};

export function getMetricsForRole(
  roleGroup: RoleGroup,
  metricsById: Record<string, MetricDefinition>,
  variant: 'dossier' | 'verdict' = 'dossier'
): MetricDefinition[] {
  const orderedIds = variant === 'verdict' ? ROLE_VERDICT_METRIC_IDS[roleGroup] : ROLE_CORE_METRIC_IDS[roleGroup];
  const list: MetricDefinition[] = [];
  for (const id of orderedIds) {
    if (metricsById[id]) list.push(metricsById[id]);
  }
  // If xG / xA exist in a future dataset, prepend them for attacking roles
  if (roleGroup === 'FWD' || roleGroup === 'WNG/AM') {
    if (metricsById['xg'] && !list.some((m) => m.id === 'xg')) {
      list.splice(2, 0, metricsById['xg']);
    }
    if (metricsById['xa'] && !list.some((m) => m.id === 'xa')) {
      list.splice(4, 0, metricsById['xa']);
    }
  }
  return list;
}

export function getIndexColumnsForRole(
  roleGroup: RoleGroup | 'ALL',
  metricsById: Record<string, MetricDefinition>
): MetricDefinition[] {
  const ids = INDEX_TABLE_METRIC_IDS[roleGroup] || INDEX_TABLE_METRIC_IDS.ALL;
  return ids.map((id) => metricsById[id]).filter((m): m is MetricDefinition => Boolean(m));
}

export function getComparisonMetrics(
  playerA: Player,
  playerB: Player,
  metricsById: Record<string, MetricDefinition>,
  expanded = false
): MetricDefinition[] {
  if (playerA.roleGroup === 'GK' && playerB.roleGroup === 'GK') {
    return getMetricsForRole('GK', metricsById, expanded ? 'dossier' : 'verdict');
  }
  if (playerA.roleGroup === playerB.roleGroup) {
    return getMetricsForRole(playerA.roleGroup, metricsById, expanded ? 'dossier' : 'verdict');
  }
  // Cross-role outfield comparison: balanced 8-metric or 12-metric tactical slate
  const hybridIds = expanded
    ? ['goals', 'npGoals', 'assists', 'npGoalContrib', 'shots', 'shotsOnTarget', 'goalsPerShot', 'crosses', 'foulsDrawn', 'tklPlusInt', 'plusMinus90', 'onOff']
    : ['goals', 'assists', 'npGoalContrib', 'shots', 'crosses', 'tklPlusInt', 'plusMinus90', 'ppm'];
  return hybridIds.map((id) => metricsById[id]).filter((m): m is MetricDefinition => Boolean(m));
}

export function evaluatePlayerProfile(
  player: Player,
  benchmark: RoleBenchmark,
  metrics: MetricDefinition[],
  mode: StatMode
): PercentileProfile {
  const evaluations: MetricEvaluation[] = metrics.map((metric) => {
    const value = getMetricValue(player, metric, mode);
    const dist = benchmark.distributions[metric.id] || [];
    const percentile = computePercentileRank(value, dist, metric.lowerIsBetter);
    return {
      metric,
      value,
      formattedValue: formatMetricValue(value, metric, mode),
      percentile,
      peerMedian: benchmark.medians[metric.id] ?? null,
      peerCount: dist.length,
      tier: getPercentileTier(percentile),
    };
  });

  const validPercentiles = evaluations
    .map((e) => e.percentile)
    .filter((p): p is number => p !== null);
  const averagePercentile =
    validPercentiles.length > 0
      ? Math.round(validPercentiles.reduce((sum, p) => sum + p, 0) / validPercentiles.length)
      : null;

  return {
    player,
    roleGroup: player.roleGroup,
    mode,
    minMinutes: benchmark.minMinutes,
    peerCount: benchmark.peerCount,
    meetsThreshold: player.minutes >= benchmark.minMinutes,
    evaluations,
    averagePercentile,
  };
}

export interface NarrativeCallout {
  label: string;
  value: string;
  context: string;
  sentiment: 'elite' | 'average' | 'below' | 'neutral';
}

/**
 * Generates factual narrative callouts strictly from columns present in the CSV.
 * Automatically activates Goals-xG and Assists-xA finishing/creation deltas when xG/xA columns exist;
 * otherwise surfaces verified conversion, non-penalty output, and team impact deltas.
 */
export function buildNarrativeCallouts(
  player: Player,
  hasXG: boolean,
  hasXA: boolean
): NarrativeCallout[] {
  const callouts: NarrativeCallout[] = [];

  if (hasXG && player.metrics['Gls'] !== null && player.metrics['xG'] !== null) {
    const delta = (player.metrics['Gls'] ?? 0) - (player.metrics['xG'] ?? 0);
    callouts.push({
      label: 'Finishing Delta (G − xG)',
      value: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`,
      context:
        delta >= 1.5
          ? 'Clinical finishing above expected chance quality'
          : delta <= -1.5
            ? 'Trailing expected goal volume on current conversion'
            : 'Scoring in line with expected shot quality',
      sentiment: delta >= 1.0 ? 'elite' : delta <= -1.0 ? 'below' : 'average',
    });
  }

  if (hasXA && player.metrics['Ast'] !== null && player.metrics['xA'] !== null) {
    const delta = (player.metrics['Ast'] ?? 0) - (player.metrics['xA'] ?? 0);
    callouts.push({
      label: 'Creation Delta (A − xA)',
      value: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`,
      context:
        delta >= 1.0
          ? 'Teammates converting chances at an elevated clip'
          : delta <= -1.0
            ? 'Creative volume awaiting sharper finishing'
            : 'Assists tracking expected chance creation',
      sentiment: delta >= 1.0 ? 'elite' : delta <= -1.0 ? 'below' : 'average',
    });
  }

  if (player.roleGroup === 'GK') {
    const savePct = player.metrics['Save%'];
    const ga90 = player.metrics['GA90'];
    const csPct = player.metrics['CS%'];
    if (savePct !== null && savePct !== undefined) {
      callouts.push({
        label: 'Shot-Stopping Efficiency',
        value: `${savePct.toFixed(1)}%`,
        context:
          savePct >= 75
            ? 'Top-tier save percentage across European peers'
            : savePct >= 68
              ? 'Solid baseline shot-stopping return'
              : 'High shot conversion conceded on frame',
        sentiment: savePct >= 75 ? 'elite' : savePct >= 68 ? 'average' : 'below',
      });
    }
    if (ga90 !== null && ga90 !== undefined) {
      callouts.push({
        label: 'Concession Rate (GA / 90)',
        value: ga90.toFixed(2),
        context: `${player.metrics['GA'] ?? 0} goals conceded across ${player.nineties.toFixed(1)} nineties`,
        sentiment: ga90 <= 1.05 ? 'elite' : ga90 <= 1.5 ? 'average' : 'below',
      });
    }
    if (csPct !== null && csPct !== undefined) {
      callouts.push({
        label: 'Shutout Conversion',
        value: `${csPct.toFixed(1)}%`,
        context: `${player.metrics['CS'] ?? 0} clean sheets in ${player.starts} starts`,
        sentiment: csPct >= 38 ? 'elite' : csPct >= 25 ? 'average' : 'below',
      });
    }
    return callouts;
  }

  // Outfield verified callouts from real CSV columns
  if (!hasXG) {
    const gPerSh = player.metrics['G/Sh'];
    const sotPct = player.metrics['SoT%'];
    const sh = player.metrics['Sh'] ?? 0;
    if (gPerSh !== null && gPerSh !== undefined && sh >= 5) {
      callouts.push({
        label: 'Shot Conversion (G / Sh)',
        value: `${(gPerSh * 100).toFixed(1)}%`,
        context: `${player.metrics['Gls'] ?? 0} goals from ${sh} shots (${sotPct !== null && sotPct !== undefined ? `${sotPct.toFixed(1)}% on target` : 'open play'})`,
        sentiment: gPerSh >= 0.18 ? 'elite' : gPerSh >= 0.1 ? 'average' : 'below',
      });
    } else if (player.metrics['TklW'] !== null && player.metrics['Int'] !== null) {
      const rec = (player.metrics['TklW'] ?? 0) + (player.metrics['Int'] ?? 0);
      const rec90 = computePer90(rec, player.minutes);
      callouts.push({
        label: 'Ball Recoveries (TklW + Int)',
        value: rec90 !== null ? `${rec90.toFixed(2)} / 90` : `${rec}`,
        context: `${player.metrics['TklW'] ?? 0} tackles won and ${player.metrics['Int'] ?? 0} interceptions`,
        sentiment: (rec90 ?? 0) >= 3.2 ? 'elite' : (rec90 ?? 0) >= 1.8 ? 'average' : 'below',
      });
    }
  }

  const plusMinus90 = player.metrics['+/-90'];
  if (plusMinus90 !== null && plusMinus90 !== undefined) {
    callouts.push({
      label: 'On-Pitch Goal Diff / 90',
      value: `${plusMinus90 > 0 ? '+' : ''}${plusMinus90.toFixed(2)}`,
      context: `Team scored ${player.metrics['onG'] ?? 0} and conceded ${player.metrics['onGA'] ?? 0} with player on pitch`,
      sentiment: plusMinus90 >= 0.75 ? 'elite' : plusMinus90 >= -0.2 ? 'average' : 'below',
    });
  }

  const onOff = player.metrics['On-Off'];
  if (onOff !== null && onOff !== undefined) {
    callouts.push({
      label: 'On-Off Pitch Swing',
      value: `${onOff > 0 ? '+' : ''}${onOff.toFixed(2)}`,
      context:
        onOff >= 0.5
          ? 'Squad goal differential strengthens noticeably when active'
          : onOff <= -0.5
            ? 'Team net goal margin dips during active minutes'
            : 'Squad goal differential remains steady across rotations',
      sentiment: onOff >= 0.5 ? 'elite' : onOff <= -0.5 ? 'below' : 'average',
    });
  }

  return callouts.slice(0, 3);
}
