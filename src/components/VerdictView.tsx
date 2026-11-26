import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Download, Search } from 'lucide-react';
import {
  buildVerdictRows,
  type ExportCardPayload,
} from '../lib/cardRenderer';
import {
  computePercentileRank,
  getComparisonMetrics,
  getMetricValue,
} from '../lib/statsEngine';
import { getRoleBenchmarks } from '../services/playerRepository';
import type {
  CuratedMatchup,
  MetricDefinition,
  Player,
  RoleBenchmark,
  StatMode,
} from '../types/player';
import { RadarPlot, type RadarAxisPoint } from './RadarPlot';

interface VerdictViewProps {
  allPlayers: Player[];
  playerA: Player;
  playerB: Player;
  matchups: CuratedMatchup[];
  mode: StatMode;
  minMinutes: number;
  metricsById: Record<string, MetricDefinition>;
  onSelectPlayerA: (player: Player) => void;
  onSelectPlayerB: (player: Player) => void;
  onSwapPlayers: () => void;
  onOpenDossier: (player: Player) => void;
  onExportCard: (payload: ExportCardPayload) => void;
}

export function VerdictView({
  allPlayers,
  playerA,
  playerB,
  matchups,
  mode,
  minMinutes,
  metricsById,
  onSelectPlayerA,
  onSelectPlayerB,
  onSwapPlayers,
  onOpenDossier,
  onExportCard,
}: VerdictViewProps) {
  const [expandedMetrics, setExpandedMetrics] = useState(false);
  const [benchmarkA, setBenchmarkA] = useState<RoleBenchmark | null>(null);
  const [benchmarkB, setBenchmarkB] = useState<RoleBenchmark | null>(null);

  const metrics = useMemo(
    () => getComparisonMetrics(playerA, playerB, metricsById, expandedMetrics),
    [playerA, playerB, metricsById, expandedMetrics]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRoleBenchmarks(playerA.roleGroup, minMinutes, mode),
      getRoleBenchmarks(playerB.roleGroup, minMinutes, mode),
    ]).then(([bmA, bmB]) => {
      if (cancelled) return;
      setBenchmarkA(bmA);
      setBenchmarkB(bmB);
    });
    return () => {
      cancelled = true;
    };
  }, [playerA.roleGroup, playerB.roleGroup, minMinutes, mode]);

  const { rows, winsA, winsB, ties } = useMemo(() => {
    const pctMapA: Record<string, number | null> = {};
    const pctMapB: Record<string, number | null> = {};

    for (const metric of metrics) {
      const valA = getMetricValue(playerA, metric, mode);
      const valB = getMetricValue(playerB, metric, mode);
      pctMapA[metric.id] = benchmarkA
        ? computePercentileRank(valA, benchmarkA.distributions[metric.id] || [], metric.lowerIsBetter)
        : null;
      pctMapB[metric.id] = benchmarkB
        ? computePercentileRank(valB, benchmarkB.distributions[metric.id] || [], metric.lowerIsBetter)
        : null;
    }

    return buildVerdictRows(playerA, playerB, metrics, pctMapA, pctMapB, mode);
  }, [playerA, playerB, metrics, benchmarkA, benchmarkB, mode]);

  const radarPoints: RadarAxisPoint[] = useMemo(
    () =>
      rows.slice(0, 8).map((r) => ({
        id: r.metric.id,
        shortLabel: r.metric.shortLabel,
        label: r.metric.label,
        pctA: r.pctA,
        valA: r.formattedA,
        pctB: r.pctB,
        valB: r.formattedB,
      })),
    [rows]
  );

  const handleApplyPreset = (m: CuratedMatchup) => {
    const foundA = allPlayers.find((p) => p.id === m.playerAId);
    const foundB = allPlayers.find((p) => p.id === m.playerBId);
    if (foundA) onSelectPlayerA(foundA);
    if (foundB) onSelectPlayerB(foundB);
  };

  return (
    <section aria-label="1v1 Head-to-Head Verdict" className="space-y-6">
      {/* Top Bar: Header + Mode + Export Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="font-editorial text-3xl sm:text-[34px] font-medium tracking-[-0.02em] text-[#EDEDED] leading-[1.15]">
            1v1 Verdict
          </h1>
          <p className="text-[13px] text-[#9898A0] mt-1.5">
            Head-to-head comparison · {mode === 'per90' ? 'Per 90 rates' : 'Season totals'} · Bars
            scaled by positional percentile ({minMinutes > 0 ? `${minMinutes}+ mins` : 'all mins'})
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-[#19191C] border border-white/[0.08] rounded-lg h-9">
            <button
              type="button"
              onClick={() => setExpandedMetrics(false)}
              className={`px-3 h-7 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                !expandedMetrics
                  ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#9898A0] hover:text-[#EDEDED]'
              }`}
            >
              Core (8)
            </button>
            <button
              type="button"
              onClick={() => setExpandedMetrics(true)}
              className={`px-3 h-7 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                expandedMetrics
                  ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#9898A0] hover:text-[#EDEDED]'
              }`}
            >
              Full Slate
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onExportCard({
                kind: 'verdict',
                playerA,
                playerB,
                rows,
                winsA,
                winsB,
                ties,
                mode,
                minMinutes,
              })
            }
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-medium text-[#111113] bg-[#EDEDED] hover:bg-white rounded-lg transition-colors duration-150 whitespace-nowrap"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Export Card
          </button>
        </div>
      </div>

      {/* Curated Real-Data Preset Matchups */}
      {matchups.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-[#7E7E85] shrink-0 mr-1">Matchups</span>
          {matchups.map((m) => {
            const isActive =
              (playerA.id === m.playerAId && playerB.id === m.playerBId) ||
              (playerA.id === m.playerBId && playerB.id === m.playerAId);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleApplyPreset(m)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#10B981]/14 border-[#10B981]/50 text-[#EDEDED]'
                    : 'bg-[#19191C] border-white/[0.08] text-[#9898A0] hover:text-[#EDEDED] hover:border-white/[0.16]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Dual Player Selector & Matchup Masthead */}
      <div className="bg-[#19191C] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-5 items-center">
          {/* Player A Selector & Identity */}
          <div className="md:col-span-5 space-y-3">
            <PlayerCombobox
              label="Player A"
              selected={playerA}
              players={allPlayers}
              onSelect={onSelectPlayerA}
              align="left"
            />
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onOpenDossier(playerA)}
                className="text-left group"
              >
                {playerA.firstName && (
                  <div className="text-xs text-[#9898A0]">{playerA.firstName}</div>
                )}
                <div className="font-editorial text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#EDEDED] group-hover:text-[#10B981] transition-colors duration-150 leading-tight">
                  {playerA.lastName}
                </div>
              </button>
              <div className="text-xs text-[#9898A0] mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[#EDEDED] font-medium">{playerA.squad}</span>
                <span>·</span>
                <span>{playerA.league}</span>
                <span>·</span>
                <span className="font-mono">{playerA.roleGroup}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {playerA.minutes.toLocaleString('en-US')}&apos; ({playerA.nineties.toFixed(1)} 90s)
                </span>
              </div>
            </div>
          </div>

          {/* Center Category Score & Swap */}
          <div className="md:col-span-1 flex md:flex-col items-center justify-between md:justify-center gap-3 py-3 md:py-0 border-y md:border-y-0 border-white/[0.08]">
            <button
              type="button"
              onClick={onSwapPlayers}
              className="p-2 text-[#9898A0] hover:text-[#EDEDED] bg-[#232327] border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-colors duration-150"
              title="Swap Player A and Player B"
              aria-label="Swap Player A and Player B"
            >
              <ArrowLeftRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <div className="text-center">
              <div className="text-xs text-[#7E7E85]">Verdict</div>
              <div className="font-mono text-2xl font-medium tabular-nums whitespace-nowrap mt-0.5">
                <span className={winsA > winsB ? 'text-[#10B981]' : 'text-[#EDEDED]'}>
                  {winsA}
                </span>
                <span className="text-[#6E6E77] mx-1.5">–</span>
                <span className={winsB > winsA ? 'text-[#10B981]' : 'text-[#EDEDED]'}>
                  {winsB}
                </span>
              </div>
              {ties > 0 && (
                <div className="font-mono text-xs text-[#7E7E85] tabular-nums">
                  {ties} tied
                </div>
              )}
            </div>
          </div>

          {/* Player B Selector & Identity */}
          <div className="md:col-span-5 space-y-3 md:text-right">
            <PlayerCombobox
              label="Player B"
              selected={playerB}
              players={allPlayers}
              onSelect={onSelectPlayerB}
              align="right"
            />
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onOpenDossier(playerB)}
                className="text-left md:text-right group"
              >
                {playerB.firstName && (
                  <div className="text-xs text-[#9898A0]">{playerB.firstName}</div>
                )}
                <div className="font-editorial text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#EDEDED] group-hover:text-[#10B981] transition-colors duration-150 leading-tight">
                  {playerB.lastName}
                </div>
              </button>
              <div className="text-xs text-[#9898A0] mt-2 flex flex-wrap items-center md:justify-end gap-1.5">
                <span className="text-[#EDEDED] font-medium">{playerB.squad}</span>
                <span>·</span>
                <span>{playerB.league}</span>
                <span>·</span>
                <span className="font-mono">{playerB.roleGroup}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {playerB.minutes.toLocaleString('en-US')}&apos; ({playerB.nineties.toFixed(1)} 90s)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagship Analytical Split: Diverging Horizontal Bar Chart + Dual Overlay Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Diverging Horizontal Bar Chart */}
        <div className="lg:col-span-8 bg-[#19191C] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] text-xs font-medium text-[#7E7E85]">
            <span>{playerA.lastName} ({mode === 'per90' ? 'Per 90' : 'Total'})</span>
            <span className="hidden sm:inline">Category comparison</span>
            <span>{playerB.lastName} ({mode === 'per90' ? 'Per 90' : 'Total'})</span>
          </div>

          <div className="divide-y divide-white/[0.06] mt-1">
            {rows.map((row) => {
              const aWins = row.winner === 'A';
              const bWins = row.winner === 'B';
              const isTie = row.winner === 'tie';

              // Bar length scaled by positional percentile (fallback to relative magnitude if null)
              let pctWidthA = row.pctA ?? 0;
              let pctWidthB = row.pctB ?? 0;
              if (row.pctA === null && row.pctB === null && row.valA !== null && row.valB !== null) {
                const maxVal = Math.max(Math.abs(row.valA), Math.abs(row.valB), 0.001);
                pctWidthA = Math.round((Math.abs(row.valA) / maxVal) * 100);
                pctWidthB = Math.round((Math.abs(row.valB) / maxVal) * 100);
              }

              const barColorA = aWins
                ? 'bg-[#10B981]'
                : isTie
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#36363D]';
              const barColorB = bWins
                ? 'bg-[#10B981]'
                : isTie
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#36363D]';

              return (
                <div
                  key={row.metric.id}
                  className="py-3.5 grid grid-cols-[56px_1fr_108px_1fr_56px] sm:grid-cols-[76px_1fr_164px_1fr_76px] items-center gap-2 sm:gap-3.5"
                  title={row.metric.description}
                >
                  {/* Player A Numeric Value + Percentile */}
                  <div className="font-mono tabular-nums">
                    <div
                      className={`text-[13px] sm:text-sm ${
                        aWins
                          ? 'text-[#10B981] font-medium'
                          : isTie
                            ? 'text-[#F59E0B]'
                            : 'text-[#C8C8CE]'
                      }`}
                    >
                      {row.formattedA}
                    </div>
                    <div className="text-xs text-[#7E7E85]">
                      {row.pctA !== null ? `${row.pctA}p` : '—'}
                    </div>
                  </div>

                  {/* Left Diverging Track (Player A grows right-to-left) */}
                  <div className="flex justify-end">
                    <div className="w-full h-2.5 bg-[#232327] rounded-l-full flex justify-end overflow-hidden">
                      <div
                        className={`h-full rounded-l-full ${barColorA} transition-[width] duration-200`}
                        style={{ width: `${Math.max(pctWidthA > 0 ? 4 : 0, pctWidthA)}%` }}
                      />
                    </div>
                  </div>

                  {/* Center Metric Label */}
                  <div className="text-center px-1 min-w-0">
                    <div className="text-xs font-medium text-[#EDEDED] leading-tight truncate">
                      {row.metric.label}
                    </div>
                    <div className="text-[11px] font-mono text-[#7E7E85] mt-0.5">
                      {row.metric.lowerIsBetter ? 'Lower wins' : row.metric.shortLabel}
                    </div>
                  </div>

                  {/* Right Diverging Track (Player B grows left-to-right) */}
                  <div className="flex justify-start">
                    <div className="w-full h-2.5 bg-[#232327] rounded-r-full flex justify-start overflow-hidden">
                      <div
                        className={`h-full rounded-r-full ${barColorB} transition-[width] duration-200`}
                        style={{ width: `${Math.max(pctWidthB > 0 ? 4 : 0, pctWidthB)}%` }}
                      />
                    </div>
                  </div>

                  {/* Player B Numeric Value + Percentile */}
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-[13px] sm:text-sm ${
                        bWins
                          ? 'text-[#10B981] font-medium'
                          : isTie
                            ? 'text-[#F59E0B]'
                            : 'text-[#C8C8CE]'
                      }`}
                    >
                      {row.formattedB}
                    </div>
                    <div className="text-xs text-[#7E7E85]">
                      {row.pctB !== null ? `${row.pctB}p` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verdict Footnote */}
          <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#7E7E85]">
            <span>
              Emerald marks metric leader · Amber indicates exact tie
            </span>
            <span>
              {playerA.roleGroup === playerB.roleGroup
                ? `Peer cohort: ${benchmarkA?.peerCount ?? '—'} ${playerA.roleGroup}s`
                : `Cross-role: ${playerA.roleGroup} (${benchmarkA?.peerCount ?? '—'}) vs ${playerB.roleGroup} (${benchmarkB?.peerCount ?? '—'})`}
            </span>
          </div>
        </div>

        {/* Dual Overlay Percentile Radar */}
        <div className="lg:col-span-4 bg-[#19191C] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between">
          <div className="pb-3 border-b border-white/[0.08] mb-3">
            <h2 className="text-sm font-medium text-[#EDEDED]">Dual Profile Overlay</h2>
            <p className="text-xs text-[#9898A0] mt-1">
              Solid emerald ({playerA.lastName}) vs dashed off-white ({playerB.lastName})
            </p>
          </div>
          <RadarPlot
            points={radarPoints}
            nameA={playerA.lastName}
            nameB={playerB.lastName}
          />
        </div>
      </div>
    </section>
  );
}

interface PlayerComboboxProps {
  label: string;
  selected: Player;
  players: Player[];
  onSelect: (player: Player) => void;
  align: 'left' | 'right';
}

function PlayerCombobox({
  label,
  selected,
  players,
  onSelect,
  align,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...players]
        .filter((p) => p.minutes >= 450)
        .sort((a, b) => (b.metrics['G+A'] ?? 0) - (a.metrics['G+A'] ?? 0))
        .slice(0, 12);
    }
    return players
      .filter((p) =>
        `${p.name} ${p.squad} ${p.league} ${p.roleGroup}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 14);
  }, [players, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-9 flex items-center justify-between gap-2 px-3 bg-[#232327] border border-white/[0.08] hover:border-white/[0.16] rounded-lg text-xs transition-colors duration-150 ${
          align === 'right' ? 'flex-row-reverse md:flex-row' : ''
        }`}
        aria-expanded={open}
        aria-label={`Select ${label}`}
      >
        <span className="text-[#7E7E85] font-mono shrink-0">{label}</span>
        <span className="text-[#EDEDED] font-medium truncate flex-1 text-left">
          {selected.name} · {selected.squad}
        </span>
        <ChevronDown className="w-4 h-4 text-[#9898A0] shrink-0" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 w-full min-w-[280px] bg-[#19191C]/95 backdrop-blur-md border border-white/[0.1] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden text-left ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.08]">
            <Search className="w-4 h-4 text-[#7E7E85] shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter players"
              className="w-full bg-transparent text-xs text-[#EDEDED] placeholder-[#7E7E85] focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#9898A0]">
                No matching players
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#232327] transition-colors duration-150 ${
                    p.id === selected.id ? 'bg-[#232327]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#EDEDED] truncate">{p.name}</div>
                    <div className="text-xs text-[#9898A0] truncate">
                      {p.squad} · {p.roleGroup}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-[#9898A0] tabular-nums shrink-0">
                    {p.minutes}&apos;
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
