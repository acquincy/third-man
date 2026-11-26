export type RoleGroup = 'FWD' | 'WNG/AM' | 'MID' | 'DEF' | 'GK';

export type StatMode = 'per90' | 'total';

export type MetricCategory = 'attacking' | 'shooting' | 'creation' | 'defending' | 'impact' | 'goalkeeping';

export type MetricFormat = 'decimal2' | 'decimal1' | 'integer' | 'percent' | 'signed2' | 'signedInt';

export type RawPlayerRow = Record<string, string>;

export interface Player {
  id: string;
  rk: number;
  name: string;
  firstName: string;
  lastName: string;
  nation: string;
  nationCode: string;
  rawPos: string;
  roleGroup: RoleGroup;
  squad: string;
  league: string;
  rawComp: string;
  age: number | null;
  born: number | null;
  matchesPlayed: number;
  starts: number;
  minutes: number;
  nineties: number;
  /** Numeric metrics parsed strictly from columns existing in the source CSV (null if missing/blank). */
  metrics: Record<string, number | null>;
}

export interface MetricDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: MetricCategory;
  /** Source CSV columns required for this metric to be registered. */
  requiredColumns: string[];
  /** Whether the value can be scaled to per 90 when StatMode === 'per90'. */
  supportsPer90: boolean;
  /** Whether the stored value in player.metrics is already a rate/percentage. */
  isRate: boolean;
  /** True when a lower raw figure is superior (e.g. GA90, Fouls Committed). */
  lowerIsBetter?: boolean;
  /** Display formatting in Per 90 mode. */
  per90Format: MetricFormat;
  /** Display formatting in Totals mode. */
  totalFormat: MetricFormat;
  /** Extractor returning the canonical base value (totals for countable stats, or rate for rate stats). */
  extractTotal: (player: Player) => number | null;
  /** Optional override for exact per-90 value (falls back to (total / minutes) * 90). */
  extractPer90?: (player: Player) => number | null;
}

export interface MetricEvaluation {
  metric: MetricDefinition;
  value: number | null;
  formattedValue: string;
  percentile: number | null;
  peerMedian: number | null;
  peerCount: number;
  tier: 'elite' | 'average' | 'below' | 'none';
}

export interface PercentileProfile {
  player: Player;
  roleGroup: RoleGroup;
  mode: StatMode;
  minMinutes: number;
  peerCount: number;
  meetsThreshold: boolean;
  evaluations: MetricEvaluation[];
  averagePercentile: number | null;
}

export interface RoleBenchmark {
  roleGroup: RoleGroup;
  minMinutes: number;
  mode: StatMode;
  peerCount: number;
  /** Sorted numeric distributions per metricId for fast percentile lookups. */
  distributions: Record<string, number[]>;
  medians: Record<string, number | null>;
}

export interface PlayerFilterOptions {
  search?: string;
  roleGroup?: RoleGroup | 'ALL';
  league?: string;
  squad?: string;
  minMinutes?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  mode?: StatMode;
}

export interface FilterMetadata {
  leagues: string[];
  squads: string[];
  squadsByLeague: Record<string, string[]>;
  roleCounts: Record<RoleGroup | 'ALL', number>;
  totalPlayers: number;
  maxMinutes: number;
  seasonLabel: string;
  hasExpectedStats: boolean;
}

export interface CuratedMatchup {
  id: string;
  label: string;
  subtitle: string;
  roleGroup: RoleGroup;
  playerAId: string;
  playerBId: string;
}

export interface ParsedDataset {
  players: Player[];
  availableColumns: Set<string>;
  metrics: MetricDefinition[];
  metricsById: Record<string, MetricDefinition>;
  hasXG: boolean;
  hasXA: boolean;
}
