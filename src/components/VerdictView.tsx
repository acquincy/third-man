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
      {/* Top Bar: Curated Matchups + Export Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1F2229]">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-[#F4F4F5]">
            1v1 Verdict
          </h1>
          <p className="text-xs text-[#8A8F98] mt-1">
            Head-to-head comparison · {mode === 'per90' ? 'Per 90 rates' : 'Season totals'} · Bars
            scaled by positional percentile ({minMinutes > 0 ? `${minMinutes}+ mins` : 'all mins'})
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#111216] border border-[#1F2229] rounded-sm">
            <button
              type="button"
              onClick={() => setExpandedMetrics(false)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                !expandedMetrics ? 'bg-[#1F2229] text-[#F4F4F5]' : 'text-[#8A8F98] hover:text-[#F4F4F5]'
              }`}
            >
              Core (8)
            </button>
            <button
              type="button"
              onClick={() => setExpandedMetrics(true)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                expandedMetrics ? 'bg-[#1F2229] text-[#F4F4F5]' : 'text-[#8A8F98] hover:text-[#F4F4F5]'
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#09090B] bg-[#F4F4F5] hover:bg-white rounded-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Export Card (PNG)
          </button>
        </div>
      </div>

      {/* Curated Real-Data Preset Matchups */}
      {matchups.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-mono text-[#8A8F98] shrink-0 mr-1">PRESETS</span>
          {matchups.map((m) => {
            const isActive =
              (playerA.id === m.playerAId && playerB.id === m.playerBId) ||
              (playerA.id === m.playerBId && playerB.id === m.playerAId);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleApplyPreset(m)}
                className={`px-3 py-1.5 text-xs rounded-sm border transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#171A21] border-[#10B981]/60 text-[#F4F4F5]'
                    : 'bg-[#111216] border-[#1F2229] text-[#8A8F98] hover:text-[#F4F4F5] hover:border-[#333845]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Dual Player Selector & Editorial Matchup Masthead */}
      <div className="bg-[#111216] border border-[#1F2229] rounded-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
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
                  <div className="text-xs text-[#8A8F98]">{playerA.firstName}</div>
                )}
                <div className="font-editorial text-3xl sm:text-4xl font-medium text-[#F4F4F5] group-hover:text-[#10B981] transition-colors leading-tight">
                  {playerA.lastName}
                </div>
              </button>
              <div className="text-xs text-[#8A8F98] mt-1.5">
                <span className="text-[#F4F4F5]">{playerA.squad}</span> · {playerA.league} ·{' '}
                <span className="font-mono">{playerA.roleGroup}</span> ·{' '}
                <span className="font-mono tabular-nums">
                  {playerA.minutes.toLocaleString('en-US')}&apos; ({playerA.nineties.toFixed(1)} 90s)
                </span>
              </div>
            </div>
          </div>

          {/* Center Category Score & Swap */}
          <div className="md:col-span-1 flex md:flex-col items-center justify-between md:justify-center gap-3 py-2 border-y md:border-y-0 border-[#1F2229]">
            <button
              type="button"
              onClick={onSwapPlayers}
              className="p-2 text-[#8A8F98] hover:text-[#F4F4F5] bg-[#09090B] border border-[#1F2229] hover:border-[#3A3F4B] rounded-sm transition-colors"
              title="Swap Player A and Player B"
              aria-label="Swap Player A and Player B"
            >
              <ArrowLeftRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <div className="text-center">
              <div className="text-[10px] font-mono text-[#8A8F98] tracking-wider">VERDICT</div>
              <div className="font-mono text-2xl font-semibold tabular-nums whitespace-nowrap mt-0.5">
                <span className={winsA > winsB ? 'text-[#10B981]' : 'text-[#F4F4F5]'}>
                  {winsA}
                </span>
                <span className="text-[#5A5F6B] mx-1.5">–</span>
                <span className={winsB > winsA ? 'text-[#10B981]' : 'text-[#F4F4F5]'}>
                  {winsB}
                </span>
              </div>
              {ties > 0 && (
                <div className="font-mono text-[10px] text-[#8A8F98] tabular-nums">
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
                  <div className="text-xs text-[#8A8F98]">{playerB.firstName}</div>
                )}
                <div className="font-editorial text-3xl sm:text-4xl font-medium text-[#F4F4F5] group-hover:text-[#10B981] transition-colors leading-tight">
                  {playerB.lastName}
                </div>
              </button>
              <div className="text-xs text-[#8A8F98] mt-1.5">
                <span className="text-[#F4F4F5]">{playerB.squad}</span> · {playerB.league} ·{' '}
                <span className="font-mono">{playerB.roleGroup}</span> ·{' '}
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
        <div className="lg:col-span-8 bg-[#111216] border border-[#1F2229] rounded-sm p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1F2229] text-[11px] font-mono text-[#8A8F98]">
            <span>{playerA.lastName} ({mode === 'per90' ? 'PER 90' : 'TOTAL'})</span>
            <span className="hidden sm:inline">CATEGORY COMPARISON</span>
            <span>{playerB.lastName} ({mode === 'per90' ? 'PER 90' : 'TOTAL'})</span>
          </div>

          <div className="divide-y divide-[#1F2229]/60 mt-1">
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
                  : 'bg-[#323642]';
              const barColorB = bWins
                ? 'bg-[#10B981]'
                : isTie
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#323642]';

              return (
                <div
                  key={row.metric.id}
                  className="py-3.5 grid grid-cols-[56px_1fr_108px_1fr_56px] sm:grid-cols-[76px_1fr_160px_1fr_76px] items-center gap-2 sm:gap-3.5"
                  title={row.metric.description}
                >
                  {/* Player A Numeric Value + Percentile */}
                  <div className="font-mono tabular-nums">
                    <div
                      className={`text-[13px] sm:text-sm ${
                        aWins
                          ? 'text-[#10B981] font-semibold'
                          : isTie
                            ? 'text-[#F59E0B]'
                            : 'text-[#D4D7DF]'
                      }`}
                    >
                      {row.formattedA}
                    </div>
                    <div className="text-[10px] text-[#8A8F98]">
                      {row.pctA !== null ? `${row.pctA}p` : '—'}
                    </div>
                  </div>

                  {/* Left Diverging Track (Player A grows right-to-left) */}
                  <div className="flex justify-end">
                    <div className="w-full h-3 bg-[#181A20] flex justify-end overflow-hidden">
                      <div
                        className={`h-full ${barColorA} transition-all duration-200`}
                        style={{ width: `${Math.max(pctWidthA > 0 ? 4 : 0, pctWidthA)}%` }}
                      />
                    </div>
                  </div>

                  {/* Center Metric Label */}
                  <div className="text-center px-1 min-w-0">
                    <div className="text-xs font-medium text-[#F4F4F5] leading-tight truncate">
                      {row.metric.label}
                    </div>
                    <div className="text-[10px] font-mono text-[#8A8F98] mt-0.5">
                      {row.metric.lowerIsBetter ? 'Lower wins' : row.metric.shortLabel}
                    </div>
                  </div>

                  {/* Right Diverging Track (Player B grows left-to-right) */}
                  <div className="flex justify-start">
                    <div className="w-full h-3 bg-[#181A20] flex justify-start overflow-hidden">
                      <div
                        className={`h-full ${barColorB} transition-all duration-200`}
                        style={{ width: `${Math.max(pctWidthB > 0 ? 4 : 0, pctWidthB)}%` }}
                      />
                    </div>
                  </div>

                  {/* Player B Numeric Value + Percentile */}
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-[13px] sm:text-sm ${
                        bWins
                          ? 'text-[#10B981] font-semibold'
                          : isTie
                            ? 'text-[#F59E0B]'
                            : 'text-[#D4D7DF]'
                      }`}
                    >
                      {row.formattedB}
                    </div>
                    <div className="text-[10px] text-[#8A8F98]">
                      {row.pctB !== null ? `${row.pctB}p` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verdict Footnote */}
          <div className="mt-4 pt-3 border-t border-[#1F2229] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8A8F98]">
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
        <div className="lg:col-span-4 bg-[#111216] border border-[#1F2229] rounded-sm p-6 flex flex-col justify-between">
          <div className="pb-3 border-b border-[#1F2229] mb-3">
            <h2 className="text-sm font-semibold text-[#F4F4F5]">Dual Profile Overlay</h2>
            <p className="text-xs text-[#8A8F98] mt-0.5">
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
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#09090B] border border-[#1F2229] hover:border-[#3A3F4B] rounded-sm text-xs transition-colors ${
          align === 'right' ? 'flex-row-reverse md:flex-row' : ''
        }`}
        aria-expanded={open}
        aria-label={`Select ${label}`}
      >
        <span className="text-[#8A8F98] font-mono shrink-0">{label}</span>
        <span className="text-[#F4F4F5] font-medium truncate flex-1 text-left">
          {selected.name} · {selected.squad}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#8A8F98] shrink-0" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 w-full min-w-[280px] bg-[#111216]/95 backdrop-blur-md border border-[#1F2229] rounded-sm overflow-hidden text-left ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1F2229]">
            <Search className="w-3.5 h-3.5 text-[#8A8F98] shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type player or club..."
              className="w-full bg-transparent text-xs text-[#F4F4F5] placeholder-[#8A8F98] focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-[#1F2229]/60">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#8A8F98]">
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
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#191C24] transition-colors ${
                    p.id === selected.id ? 'bg-[#161920]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#F4F4F5] truncate">{p.name}</div>
                    <div className="text-[11px] text-[#8A8F98] truncate">
                      {p.squad} · {p.roleGroup}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-[#8A8F98] tabular-nums shrink-0">
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
