import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  computePercentileRank,
  formatMetricValue,
  getIndexColumnsForRole,
  getMetricValue,
} from '../lib/statsEngine';
import { getPlayers, getRoleBenchmarks } from '../services/playerRepository';
import type {
  FilterMetadata,
  MetricDefinition,
  Player,
  RoleBenchmark,
  RoleGroup,
  StatMode,
} from '../types/player';

interface IndexViewProps {
  mode: StatMode;
  minMinutes: number;
  metricsById: Record<string, MetricDefinition>;
  metadata: FilterMetadata;
  compareQueueAId: string | null;
  compareQueueBId: string | null;
  onOpenDossier: (player: Player) => void;
  onQueueCompare: (player: Player) => void;
}

const ROLE_OPTIONS: Array<{ value: RoleGroup | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'FWD', label: 'FWD' },
  { value: 'WNG/AM', label: 'WNG/AM' },
  { value: 'MID', label: 'MID' },
  { value: 'DEF', label: 'DEF' },
  { value: 'GK', label: 'GK' },
];

const PAGE_SIZE = 40;

export function IndexView({
  mode,
  minMinutes,
  metricsById,
  metadata,
  compareQueueAId,
  compareQueueBId,
  onOpenDossier,
  onQueueCompare,
}: IndexViewProps) {
  const [search, setSearch] = useState('');
  const [roleGroup, setRoleGroup] = useState<RoleGroup | 'ALL'>('ALL');
  const [league, setLeague] = useState<string>('ALL');
  const [squad, setSquad] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('npGoalContrib');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [players, setPlayers] = useState<Player[]>([]);
  const [benchmarks, setBenchmarks] = useState<Partial<Record<RoleGroup, RoleBenchmark>>>({});
  const [loading, setLoading] = useState(true);

  const columns = useMemo(
    () => getIndexColumnsForRole(roleGroup, metricsById),
    [roleGroup, metricsById]
  );

  // When switching role group, automatically default sort to that role's flagship metric
  useEffect(() => {
    const defaultSortMap: Record<RoleGroup | 'ALL', string> = {
      ALL: 'npGoalContrib',
      FWD: 'goals',
      'WNG/AM': 'npGoalContrib',
      MID: 'npGoalContrib',
      DEF: 'tklPlusInt',
      GK: 'savePct',
    };
    const nextSort = defaultSortMap[roleGroup];
    if (metricsById[nextSort]) {
      setSortBy(nextSort);
      setSortDirection(metricsById[nextSort].lowerIsBetter ? 'asc' : 'desc');
    }
    setPage(1);
  }, [roleGroup, metricsById]);

  // Reset club when league changes if club not in league
  const availableSquads = useMemo(() => {
    if (league === 'ALL') return metadata.squads;
    return metadata.squadsByLeague[league] || [];
  }, [league, metadata]);

  useEffect(() => {
    if (squad !== 'ALL' && !availableSquads.includes(squad)) {
      setSquad('ALL');
    }
  }, [league, squad, availableSquads]);

  // Query players from repository
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlayers({
      search,
      roleGroup,
      league,
      squad,
      minMinutes,
      sortBy,
      sortDirection,
      mode,
    })
      .then((list) => {
        if (!cancelled) {
          setPlayers(list);
          setPage(1);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, roleGroup, league, squad, minMinutes, sortBy, sortDirection, mode]);

  // Load role benchmarks for inline percentile bars
  useEffect(() => {
    let cancelled = false;
    const roles: RoleGroup[] = ['FWD', 'WNG/AM', 'MID', 'DEF', 'GK'];
    Promise.all(
      roles.map(async (r) => [r, await getRoleBenchmarks(r, minMinutes, mode)] as const)
    ).then((entries) => {
      if (cancelled) return;
      const map: Partial<Record<RoleGroup, RoleBenchmark>> = {};
      for (const [r, bm] of entries) {
        map[r] = bm;
      }
      setBenchmarks(map);
    });
    return () => {
      cancelled = true;
    };
  }, [minMinutes, mode]);

  const totalPages = Math.max(1, Math.ceil(players.length / PAGE_SIZE));
  const pagedPlayers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return players.slice(start, start + PAGE_SIZE);
  }, [players, page]);

  const handleSort = (colId: string) => {
    if (sortBy === colId) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(colId);
      const m = metricsById[colId];
      setSortDirection(m?.lowerIsBetter ? 'asc' : 'desc');
    }
  };

  const hasActiveFilters = search.trim() !== '' || roleGroup !== 'ALL' || league !== 'ALL' || squad !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setRoleGroup('ALL');
    setLeague('ALL');
    setSquad('ALL');
  };

  const primaryBarMetricId = columns[0]?.id;

  return (
    <section aria-label="Player Index and Leaderboard" className="space-y-5">
      {/* Compact Editorial Index Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#1F2229]">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-[#F4F4F5]">
            Season Index
          </h1>
          <p className="text-xs text-[#8A8F98] mt-1">
            {metadata.seasonLabel} · Showing{' '}
            <span className="font-mono text-[#F4F4F5] tabular-nums">
              {players.length.toLocaleString('en-US')}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums">
              {metadata.totalPlayers.toLocaleString('en-US')}
            </span>{' '}
            players ({minMinutes > 0 ? `${minMinutes}+ mins` : 'all minutes'})
          </p>
        </div>

        {/* Inline Legend */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-[#8A8F98]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1 bg-[#10B981]" />
            75–99p Elite
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1 bg-[#F59E0B]" />
            40–74p Mid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-1 bg-[#F43F5E]" />
            0–39p Low
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Role Group Filter Buttons */}
        <div
          className="inline-flex items-center gap-0.5 p-1 bg-[#111216] border border-[#1F2229] rounded-sm overflow-x-auto max-w-full"
          role="group"
          aria-label="Filter by role group"
        >
          {ROLE_OPTIONS.map((opt) => {
            const active = roleGroup === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRoleGroup(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1F2229] text-[#F4F4F5]'
                    : 'text-[#8A8F98] hover:text-[#F4F4F5]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Search + League + Squad Selectors */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-[#8A8F98] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter player, club, league..."
              aria-label="Filter players by name, club, or league"
              className="w-full pl-8 pr-3 py-2 bg-[#111216] border border-[#1F2229] focus:border-[#10B981] rounded-sm text-xs text-[#F4F4F5] placeholder-[#8A8F98] focus:outline-none"
            />
          </div>

          <select
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            aria-label="Filter by league"
            className="px-3 py-2 bg-[#111216] border border-[#1F2229] focus:border-[#10B981] rounded-sm text-xs text-[#F4F4F5] focus:outline-none"
          >
            <option value="ALL">All Leagues</option>
            {metadata.leagues.map((lg) => (
              <option key={lg} value={lg}>
                {lg}
              </option>
            ))}
          </select>

          <select
            value={squad}
            onChange={(e) => setSquad(e.target.value)}
            aria-label="Filter by club"
            className="px-3 py-2 bg-[#111216] border border-[#1F2229] focus:border-[#10B981] rounded-sm text-xs text-[#F4F4F5] focus:outline-none max-w-[168px]"
          >
            <option value="ALL">All Clubs</option>
            {availableSquads.map((sq) => (
              <option key={sq} value={sq}>
                {sq}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs text-[#8A8F98] hover:text-[#F4F4F5] border border-[#1F2229] rounded-sm transition-colors whitespace-nowrap shrink-0"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Swiss Data Table */}
      <div className="bg-[#111216] border border-[#1F2229] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#1F2229] bg-[#0D0E12] text-[11px] font-mono text-[#8A8F98]">
                <th className="py-2.5 pl-4 pr-2 w-10 font-normal">#</th>
                <th className="py-2.5 px-3 font-normal min-w-[210px]">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-[#F4F4F5] transition-colors whitespace-nowrap"
                  >
                    Player
                    <SortIcon active={sortBy === 'name'} direction={sortDirection} />
                  </button>
                </th>
                <th className="py-2.5 px-2.5 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('age')}
                    className="inline-flex items-center gap-1 hover:text-[#F4F4F5] transition-colors ml-auto"
                  >
                    Age
                    <SortIcon active={sortBy === 'age'} direction={sortDirection} />
                  </button>
                </th>
                <th className="py-2.5 px-2.5 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('minutes')}
                    className="inline-flex items-center gap-1 hover:text-[#F4F4F5] transition-colors ml-auto"
                  >
                    Min
                    <SortIcon active={sortBy === 'minutes'} direction={sortDirection} />
                  </button>
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="py-2.5 px-3 font-normal text-right whitespace-nowrap"
                    title={col.description}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.id)}
                      className={`inline-flex items-center gap-1 transition-colors ml-auto ${
                        sortBy === col.id ? 'text-[#F4F4F5]' : 'hover:text-[#F4F4F5]'
                      }`}
                    >
                      {col.shortLabel}
                      {mode === 'per90' && col.supportsPer90 ? '/90' : ''}
                      <SortIcon active={sortBy === col.id} direction={sortDirection} />
                    </button>
                  </th>
                ))}
                <th className="py-2.5 pl-2 pr-4 font-normal text-right w-24">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1F2229]/70 text-[13px]">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="h-[46px]">
                    <td colSpan={columns.length + 5} className="px-4 py-3">
                      <div className="h-3.5 bg-[#181A20] rounded-sm w-full animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pagedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 5} className="px-6 py-16 text-center">
                    <p className="text-sm text-[#F4F4F5] font-medium">
                      No players match the current filters
                    </p>
                    <p className="text-xs text-[#8A8F98] mt-1">
                      Try lowering the minimum minutes threshold or clearing club/league filters.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 px-3.5 py-2 text-xs font-medium bg-[#1F2229] hover:bg-[#2A2E38] text-[#F4F4F5] rounded-sm transition-colors"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pagedPlayers.map((player, idx) => {
                  const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                  const roleBm = benchmarks[player.roleGroup];
                  const isInCompare =
                    player.id === compareQueueAId || player.id === compareQueueBId;

                  return (
                    <tr
                      key={player.id}
                      onClick={() => onOpenDossier(player)}
                      className="group cursor-pointer hover:bg-[#16181E] transition-colors"
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-[#5A5F6B] tabular-nums">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#F4F4F5] group-hover:text-white leading-tight">
                          {player.name}
                        </div>
                        <div className="text-[11px] text-[#8A8F98] mt-0.5 truncate max-w-[260px]">
                          {player.squad} · {player.league} · {player.roleGroup}
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-xs text-[#8A8F98] text-right tabular-nums">
                        {player.age ?? '—'}
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-xs text-[#8A8F98] text-right tabular-nums">
                        {player.minutes.toLocaleString('en-US')}
                      </td>

                      {columns.map((col) => {
                        const rawVal = getMetricValue(player, col, mode);
                        const formatted = formatMetricValue(rawVal, col, mode);
                        const dist = roleBm?.distributions[col.id] || [];
                        const pct = computePercentileRank(rawVal, dist, col.lowerIsBetter);
                        const showMiniBar = col.id === sortBy || col.id === primaryBarMetricId;
                        const barColor =
                          pct === null
                            ? 'bg-[#2C303A]'
                            : pct >= 75
                              ? 'bg-[#10B981]'
                              : pct >= 40
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#F43F5E]';

                        return (
                          <td
                            key={col.id}
                            className={`py-2.5 px-3 font-mono text-xs text-right tabular-nums ${
                              col.id === sortBy ? 'text-[#F4F4F5] font-medium' : 'text-[#C8CCD4]'
                            }`}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span>{formatted}</span>
                              {showMiniBar && pct !== null && (
                                <div
                                  className="w-14 h-[3px] bg-[#1D2028] overflow-hidden"
                                  title={`${pct}th percentile among ${player.roleGroup} peers`}
                                >
                                  <div
                                    className={`h-full ${barColor}`}
                                    style={{ width: `${Math.max(4, pct)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td
                        className="py-2.5 pl-2 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onQueueCompare(player)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-sm border transition-colors whitespace-nowrap ${
                            isInCompare
                              ? 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/10'
                              : 'border-[#1F2229] text-[#8A8F98] hover:text-[#F4F4F5] hover:border-[#3A3F4B]'
                          }`}
                        >
                          <Plus className="w-3 h-3" strokeWidth={1.5} />
                          Compare
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {players.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1F2229] bg-[#0D0E12] text-xs text-[#8A8F98]">
            <span className="font-mono tabular-nums">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, players.length)} of{' '}
              {players.length.toLocaleString('en-US')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#1F2229] rounded-sm text-xs text-[#F4F4F5] disabled:opacity-35 hover:bg-[#16181E] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                Prev
              </button>
              <span className="font-mono px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#1F2229] rounded-sm text-xs text-[#F4F4F5] disabled:opacity-35 hover:bg-[#16181E] transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) {
    return <ArrowUpDown className="w-3 h-3 text-[#4B505C]" strokeWidth={1.5} />;
  }
  return direction === 'desc' ? (
    <ArrowDown className="w-3 h-3 text-[#10B981]" strokeWidth={1.5} />
  ) : (
    <ArrowUp className="w-3 h-3 text-[#10B981]" strokeWidth={1.5} />
  );
}
