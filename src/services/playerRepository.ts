import { adaptCsvRowsToPlayers, parseCsvText } from '../lib/csvAdapter';
import {
  buildRoleBenchmark,
  getMetricValue,
  registerAvailableMetrics,
} from '../lib/statsEngine';
import type {
  CuratedMatchup,
  FilterMetadata,
  MetricDefinition,
  ParsedDataset,
  Player,
  PlayerFilterOptions,
  RoleBenchmark,
  RoleGroup,
  StatMode,
} from '../types/player';

const CSV_DATASET_URL = '/assets/aistudio/players_data-2026_2027_8f2702d4.csv';
const SEASON_LABEL = '2026/27 Season · Top-5 European Leagues';

let datasetPromise: Promise<ParsedDataset> | null = null;
const benchmarkCache = new Map<string, RoleBenchmark>();

/**
 * Loads and caches the player dataset.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace the CSV fetch + parse below with:
 *   const { data, error } = await supabase.from('player_season_stats').select('*');
 * and map rows to the identical `Player` domain model without touching any UI components.
 */
export async function loadDataset(): Promise<ParsedDataset> {
  if (!datasetPromise) {
    datasetPromise = (async () => {
      const response = await fetch(CSV_DATASET_URL);
      if (!response.ok) {
        throw new Error(`Unable to load season statistics CSV (HTTP ${response.status}).`);
      }
      const csvText = await response.text();
      const { headers, rows } = parseCsvText(csvText);
      const { players, availableColumns } = adaptCsvRowsToPlayers(headers, rows);
      const { metrics, metricsById } = registerAvailableMetrics(availableColumns);

      return {
        players,
        availableColumns,
        metrics,
        metricsById,
        hasXG: availableColumns.has('xG'),
        hasXA: availableColumns.has('xA'),
      };
    })();
  }
  return datasetPromise;
}

/**
 * Queries filtered & sorted players.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace in-memory filtering with parameterized Supabase query builder filters:
 *   supabase.from('player_season_stats')
 *     .select('*')
 *     .gte('minutes', filters.minMinutes ?? 0)
 *     .eq('role_group', filters.roleGroup)
 *     .ilike('player', `%${filters.search}%`)
 */
export async function getPlayers(filters: PlayerFilterOptions = {}): Promise<Player[]> {
  const { players, metricsById } = await loadDataset();
  const {
    search = '',
    roleGroup = 'ALL',
    league = 'ALL',
    squad = 'ALL',
    minMinutes = 0,
    sortBy = 'npGoalContrib',
    sortDirection = 'desc',
    mode = 'per90',
  } = filters;

  const q = search.trim().toLowerCase();

  const filtered = players.filter((p) => {
    if (minMinutes > 0 && p.minutes < minMinutes) return false;
    if (roleGroup !== 'ALL' && p.roleGroup !== roleGroup) return false;
    if (league !== 'ALL' && p.league !== league) return false;
    if (squad !== 'ALL' && p.squad !== squad) return false;
    if (q) {
      const hay = `${p.name} ${p.squad} ${p.league} ${p.nation} ${p.rawPos} ${p.roleGroup}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = sortDirection === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
    if (sortBy === 'squad') return a.squad.localeCompare(b.squad) * dir;
    if (sortBy === 'age') return ((a.age ?? -1) - (b.age ?? -1)) * dir;
    if (sortBy === 'minutes') return (a.minutes - b.minutes) * dir;
    if (sortBy === 'matchesPlayed') return (a.matchesPlayed - b.matchesPlayed) * dir;

    const metric = metricsById[sortBy];
    if (metric) {
      const va = getMetricValue(a, metric, mode);
      const vb = getMetricValue(b, metric, mode);
      if (va === null && vb === null) return b.minutes - a.minutes;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va !== vb) return (va - vb) * dir;
    }
    return b.minutes - a.minutes;
  });

  return filtered;
}

/**
 * Retrieves a single player by deterministic ID.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace with:
 *   const { data } = await supabase.from('player_season_stats').select('*').eq('id', id).single();
 */
export async function getPlayerById(id: string): Promise<Player | null> {
  const { players } = await loadDataset();
  return players.find((p) => p.id === id) ?? null;
}

/**
 * Computes (and memoizes) positional benchmark distributions for percentile ranking.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace with an RPC call or materialized view query:
 *   supabase.rpc('get_role_percentiles', { role_group: role, min_minutes: minMinutes, stat_mode: mode });
 */
export async function getRoleBenchmarks(
  role: RoleGroup,
  minMinutes: number,
  mode: StatMode = 'per90'
): Promise<RoleBenchmark> {
  const key = `${role}:${minMinutes}:${mode}`;
  const cached = benchmarkCache.get(key);
  if (cached) return cached;

  const { players, metrics } = await loadDataset();
  const benchmark = buildRoleBenchmark(players, role, minMinutes, mode, metrics);
  benchmarkCache.set(key, benchmark);
  return benchmark;
}

export async function getAvailableMetrics(): Promise<{
  metrics: MetricDefinition[];
  metricsById: Record<string, MetricDefinition>;
  hasXG: boolean;
  hasXA: boolean;
}> {
  const { metrics, metricsById, hasXG, hasXA } = await loadDataset();
  return { metrics, metricsById, hasXG, hasXA };
}

/**
 * Returns distinct leagues, squads, and role counts from the real dataset.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace with a lightweight metadata view query in Supabase.
 */
export async function getFilterMetadata(): Promise<FilterMetadata> {
  const { players, hasXG, hasXA } = await loadDataset();
  const leagueSet = new Set<string>();
  const squadSet = new Set<string>();
  const squadsByLeagueMap = new Map<string, Set<string>>();

  const roleCounts: Record<RoleGroup | 'ALL', number> = {
    ALL: players.length,
    FWD: 0,
    'WNG/AM': 0,
    MID: 0,
    DEF: 0,
    GK: 0,
  };

  let maxMinutes = 0;

  for (const p of players) {
    leagueSet.add(p.league);
    squadSet.add(p.squad);
    if (!squadsByLeagueMap.has(p.league)) {
      squadsByLeagueMap.set(p.league, new Set());
    }
    squadsByLeagueMap.get(p.league)!.add(p.squad);
    roleCounts[p.roleGroup] += 1;
    if (p.minutes > maxMinutes) maxMinutes = p.minutes;
  }

  const squadsByLeague: Record<string, string[]> = {};
  for (const [lg, set] of squadsByLeagueMap.entries()) {
    squadsByLeague[lg] = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  return {
    leagues: Array.from(leagueSet).sort((a, b) => a.localeCompare(b)),
    squads: Array.from(squadSet).sort((a, b) => a.localeCompare(b)),
    squadsByLeague,
    roleCounts,
    totalPlayers: players.length,
    maxMinutes,
    seasonLabel: SEASON_LABEL,
    hasExpectedStats: hasXG || hasXA,
  };
}

/**
 * Dynamically builds marquee 1v1 preset matchups from top-performing real players in the CSV.
 *
 * // SUPABASE_MIGRATION_BOUNDARY
 * Replace with curated_matchups table or top-ranked RPC query.
 */
export async function getCuratedMatchups(): Promise<CuratedMatchup[]> {
  const { players } = await loadDataset();

  const findByName = (target: string): Player | undefined =>
    players.find((p) => p.name.toLowerCase() === target.toLowerCase() && p.minutes >= 450);

  const matchups: CuratedMatchup[] = [];

  // 1. Top Forwards clash
  const raphinha = findByName('Raphinha');
  const mbappe = findByName('Kylian Mbappé');
  const haaland = findByName('Erling Haaland');
  const yamal = findByName('Lamine Yamal');
  const kane = findByName('Harry Kane');

  if (raphinha && mbappe) {
    matchups.push({
      id: 'raphinha-mbappe',
      label: 'Raphinha vs Mbappé',
      subtitle: 'La Liga Scoring Leaders · FWD',
      roleGroup: 'FWD',
      playerAId: raphinha.id,
      playerBId: mbappe.id,
    });
  }

  if (mbappe && haaland) {
    matchups.push({
      id: 'mbappe-haaland',
      label: 'Mbappé vs Haaland',
      subtitle: 'Striker Output Benchmark · FWD',
      roleGroup: 'FWD',
      playerAId: mbappe.id,
      playerBId: haaland.id,
    });
  }

  if (yamal && kane) {
    matchups.push({
      id: 'yamal-kane',
      label: 'Lamine Yamal vs Kane',
      subtitle: 'Top Creators · 8 Assists Each',
      roleGroup: 'WNG/AM',
      playerAId: yamal.id,
      playerBId: kane.id,
    });
  }

  // Dynamic top-2 Midfielders by npG+A (min 450 mins)
  const topMids = players
    .filter((p) => p.roleGroup === 'MID' && p.minutes >= 450)
    .sort((a, b) => (b.metrics['G+A'] ?? 0) - (a.metrics['G+A'] ?? 0));
  if (topMids.length >= 2) {
    matchups.push({
      id: 'top-mids',
      label: `${topMids[0].lastName} vs ${topMids[1].lastName}`,
      subtitle: 'Midfield Engine Duel · MID',
      roleGroup: 'MID',
      playerAId: topMids[0].id,
      playerBId: topMids[1].id,
    });
  }

  // Dynamic top-2 Defenders by TklW + Int (min 450 mins)
  const topDefs = players
    .filter((p) => p.roleGroup === 'DEF' && p.minutes >= 450)
    .sort(
      (a, b) =>
        (b.metrics['TklW'] ?? 0) +
        (b.metrics['Int'] ?? 0) -
        ((a.metrics['TklW'] ?? 0) + (a.metrics['Int'] ?? 0))
    );
  if (topDefs.length >= 2) {
    matchups.push({
      id: 'top-defs',
      label: `${topDefs[0].lastName} vs ${topDefs[1].lastName}`,
      subtitle: 'Ball-Winning Defenders · DEF',
      roleGroup: 'DEF',
      playerAId: topDefs[0].id,
      playerBId: topDefs[1].id,
    });
  }

  // Dynamic top-2 Goalkeepers by Saves & Save% (min 450 mins)
  const topGks = players
    .filter((p) => p.roleGroup === 'GK' && p.minutes >= 450)
    .sort((a, b) => (b.metrics['Save%'] ?? 0) - (a.metrics['Save%'] ?? 0));
  if (topGks.length >= 2) {
    matchups.push({
      id: 'top-gks',
      label: `${topGks[0].lastName} vs ${topGks[1].lastName}`,
      subtitle: 'Shot-Stopping Leaders · GK',
      roleGroup: 'GK',
      playerAId: topGks[0].id,
      playerBId: topGks[1].id,
    });
  }

  return matchups;
}

/**
 * Finds top positional peers with similar statistical profiles for Dossier context.
 */
export async function getTopRolePeers(
  player: Player,
  minMinutes: number,
  limit = 5
): Promise<Player[]> {
  const { players } = await loadDataset();
  const candidates = players.filter(
    (p) => p.id !== player.id && p.roleGroup === player.roleGroup && p.minutes >= Math.max(minMinutes, 450)
  );

  // Rank peers by primary role metric
  candidates.sort((a, b) => {
    if (player.roleGroup === 'GK') {
      return (b.metrics['Save%'] ?? 0) - (a.metrics['Save%'] ?? 0);
    }
    if (player.roleGroup === 'DEF') {
      const aRec = (a.metrics['TklW'] ?? 0) + (a.metrics['Int'] ?? 0);
      const bRec = (b.metrics['TklW'] ?? 0) + (b.metrics['Int'] ?? 0);
      return bRec - aRec;
    }
    return (b.metrics['G+A'] ?? 0) - (a.metrics['G+A'] ?? 0);
  });

  return candidates.slice(0, limit);
}
