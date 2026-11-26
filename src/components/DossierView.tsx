import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Scale, Search } from 'lucide-react';
import {
  buildNarrativeCallouts,
  evaluatePlayerProfile,
  getMetricsForRole,
} from '../lib/statsEngine';
import { getRoleBenchmarks, getTopRolePeers } from '../services/playerRepository';
import type {
  MetricDefinition,
  PercentileProfile,
  Player,
  StatMode,
} from '../types/player';
import type { ExportCardPayload } from '../lib/cardRenderer';
import { RadarPlot, type RadarAxisPoint } from './RadarPlot';

interface DossierViewProps {
  player: Player;
  mode: StatMode;
  minMinutes: number;
  metricsById: Record<string, MetricDefinition>;
  hasXG: boolean;
  hasXA: boolean;
  onBackToIndex: () => void;
  onComparePlayer: (player: Player, opponent?: Player) => void;
  onSelectPlayer: (player: Player) => void;
  onOpenSearch: () => void;
  onExportCard: (payload: ExportCardPayload) => void;
}

const TIER_STYLES = {
  elite: {
    bar: 'bg-[#10B981]',
    badge: 'bg-[#10B981] text-[#081C15]',
    text: 'text-[#10B981]',
    label: 'Elite',
  },
  average: {
    bar: 'bg-[#F59E0B]',
    badge: 'bg-[#F59E0B] text-[#1A1205]',
    text: 'text-[#F59E0B]',
    label: 'Mid',
  },
  below: {
    bar: 'bg-[#E5484D]',
    badge: 'bg-[#E5484D] text-white',
    text: 'text-[#E5484D]',
    label: 'Low',
  },
  none: {
    bar: 'bg-[#2E2E34]',
    badge: 'bg-[#232327] text-[#9898A0]',
    text: 'text-[#9898A0]',
    label: '—',
  },
};

export function DossierView({
  player,
  mode,
  minMinutes,
  metricsById,
  hasXG,
  hasXA,
  onBackToIndex,
  onComparePlayer,
  onSelectPlayer,
  onOpenSearch,
  onExportCard,
}: DossierViewProps) {
  const [profile, setProfile] = useState<PercentileProfile | null>(null);
  const [peers, setPeers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const roleMetrics = useMemo(
    () => getMetricsForRole(player.roleGroup, metricsById, 'dossier'),
    [player.roleGroup, metricsById]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getRoleBenchmarks(player.roleGroup, minMinutes, mode),
      getTopRolePeers(player, minMinutes, 5),
    ])
      .then(([benchmark, topPeers]) => {
        if (cancelled) return;
        const evalProfile = evaluatePlayerProfile(player, benchmark, roleMetrics, mode);
        setProfile(evalProfile);
        setPeers(topPeers);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [player, minMinutes, mode, roleMetrics]);

  const callouts = useMemo(
    () => buildNarrativeCallouts(player, hasXG, hasXA),
    [player, hasXG, hasXA]
  );

  const radarPoints: RadarAxisPoint[] = useMemo(() => {
    if (!profile) return [];
    return profile.evaluations.slice(0, 8).map((ev) => ({
      id: ev.metric.id,
      shortLabel: ev.metric.shortLabel,
      label: ev.metric.label,
      pctA: ev.percentile,
      valA: ev.formattedValue,
    }));
  }, [profile]);

  const initials = useMemo(() => {
    const first = player.firstName?.[0] || player.name[0] || '';
    const last = player.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  }, [player.firstName, player.lastName, player.name]);

  return (
    <section aria-label={`Player Dossier for ${player.name}`} className="space-y-6">
      {/* Top Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToIndex}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9898A0] hover:text-[#EDEDED] transition-colors duration-150 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Back to Index
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-[#9898A0] hover:text-[#EDEDED] bg-[#19191C] border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-colors duration-150 whitespace-nowrap"
          >
            <Search className="w-4 h-4" strokeWidth={1.5} />
            Switch Player
          </button>
          <button
            type="button"
            onClick={() => onComparePlayer(player)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-[#EDEDED] bg-[#19191C] hover:bg-[#232327] border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-colors duration-150 whitespace-nowrap"
          >
            <Scale className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} />
            Compare Player
          </button>
          <button
            type="button"
            disabled={!profile}
            onClick={() => {
              if (!profile) return;
              onExportCard({ kind: 'dossier', profile });
            }}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-medium text-[#111113] bg-[#EDEDED] hover:bg-white rounded-lg transition-colors duration-150 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Export Card
          </button>
        </div>
      </div>

      {/* FotMob-inspired Player Bio & Appearance Card */}
      <div className="bg-[#19191C] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5 min-w-0">
            {/* Clean Neutral Player Monogram */}
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#232327] border border-white/[0.1] flex items-center justify-center shrink-0 font-editorial text-xl sm:text-2xl font-medium text-[#EDEDED]"
              aria-hidden="true"
            >
              {initials}
            </div>

            <div className="min-w-0">
              {player.firstName && (
                <div className="text-sm text-[#9898A0] font-medium mb-0.5">
                  {player.firstName}
                </div>
              )}
              <h1 className="font-editorial text-3xl sm:text-[44px] font-medium tracking-[-0.02em] text-[#EDEDED] leading-[1.05]">
                {player.lastName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9898A0] mt-3">
                <span className="px-2.5 py-1 rounded-full bg-[#232327] text-[#EDEDED] font-medium">
                  {player.squad}
                </span>
                <span>{player.league}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#EDEDED]">
                  {player.rawPos} ({player.roleGroup})
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{player.nationCode}</span>
                {player.age !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Age {player.age}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quantitative Appearance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/[0.08] shrink-0">
            <div className="bg-[#232327]/70 border border-white/[0.06] rounded-xl px-4 py-3 min-w-[88px]">
              <div className="text-xs text-[#9898A0]">Minutes</div>
              <div className="font-mono text-lg font-medium text-[#EDEDED] tabular-nums mt-0.5">
                {player.minutes.toLocaleString('en-US')}
              </div>
            </div>
            <div className="bg-[#232327]/70 border border-white/[0.06] rounded-xl px-4 py-3 min-w-[80px]">
              <div className="text-xs text-[#9898A0]">90s</div>
              <div className="font-mono text-lg font-medium text-[#EDEDED] tabular-nums mt-0.5">
                {player.nineties.toFixed(1)}
              </div>
            </div>
            <div className="bg-[#232327]/70 border border-white/[0.06] rounded-xl px-4 py-3 min-w-[84px]">
              <div className="text-xs text-[#9898A0]">Matches</div>
              <div className="font-mono text-lg font-medium text-[#EDEDED] tabular-nums mt-0.5">
                {player.matchesPlayed}
              </div>
            </div>
            <div className="bg-[#232327]/70 border border-white/[0.06] rounded-xl px-4 py-3 min-w-[80px]">
              <div className="text-xs text-[#9898A0]">Starts</div>
              <div className="font-mono text-lg font-medium text-[#EDEDED] tabular-nums mt-0.5">
                {player.starts}
              </div>
            </div>
          </div>
        </div>

        {/* Low-sample notice if player is below current minMinutes benchmark */}
        {profile && !profile.meetsThreshold && (
          <div className="mt-5 pt-4 border-t border-white/[0.08] text-xs text-[#F59E0B] flex items-center justify-between gap-4">
            <span>
              Sample advisory: {player.name} has {player.minutes} minutes played, below the active{' '}
              {minMinutes}+ minute peer cohort. Percentiles are projected against {profile.peerCount}{' '}
              qualifying {player.roleGroup} peers.
            </span>
          </div>
        )}
      </div>

      {/* Narrative Callout Strip */}
      {callouts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {callouts.map((item) => {
            const accent =
              item.sentiment === 'elite'
                ? 'text-[#10B981]'
                : item.sentiment === 'below'
                  ? 'text-[#E5484D]'
                  : item.sentiment === 'average'
                    ? 'text-[#F59E0B]'
                    : 'text-[#EDEDED]';
            return (
              <div
                key={item.label}
                className="bg-[#19191C] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-[#9898A0] font-medium">{item.label}</span>
                  <span className={`font-mono text-xl font-medium tabular-nums ${accent}`}>
                    {item.value}
                  </span>
                </div>
                <p className="text-xs text-[#9898A0] mt-2.5 leading-relaxed">{item.context}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Analytical Grid: Role-Aware Percentile Bars + Shape Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Percentile Breakdown Bars */}
        <div className="lg:col-span-8 bg-[#19191C] border border-white/[0.08] rounded-2xl p-6 flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-white/[0.08]">
            <div>
              <h2 className="text-sm font-medium text-[#EDEDED]">
                Positional Percentile Breakdown
              </h2>
              <p className="text-xs text-[#9898A0] mt-1">
                Ranked 0–99 against{' '}
                <span className="font-mono text-[#EDEDED] tabular-nums">
                  {profile?.peerCount ?? '—'}
                </span>{' '}
                {player.roleGroup} peers ({minMinutes > 0 ? `${minMinutes}+ mins` : 'all mins'}) ·{' '}
                {mode === 'per90' ? 'Per 90 rates' : 'Season totals'}
              </p>
            </div>
            <div className="text-xs font-mono text-[#7E7E85] tabular-nums">
              {mode === 'per90' ? 'Per 90' : 'Total'} · Percentile
            </div>
          </div>

          <div className="mt-2 divide-y divide-white/[0.06] flex-1">
            {loading || !profile
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="py-3.5">
                    <div className="h-4 bg-[#232327] rounded-md" />
                  </div>
                ))
              : profile.evaluations.map((ev) => {
                  const style = TIER_STYLES[ev.tier];
                  const pct = ev.percentile ?? 0;

                  return (
                    <div
                      key={ev.metric.id}
                      className="py-3.5 grid grid-cols-12 items-center gap-3 group"
                      title={ev.metric.description}
                    >
                      <div className="col-span-5 sm:col-span-4 min-w-0">
                        <div className="text-[13px] font-medium text-[#EDEDED] truncate">
                          {ev.metric.label}
                        </div>
                        <div className="text-xs text-[#7E7E85] font-mono">
                          {ev.metric.lowerIsBetter ? 'Lower is better' : ev.metric.shortLabel}
                        </div>
                      </div>

                      {/* Horizontal Percentile Bar with 50th median tick */}
                      <div className="col-span-4 sm:col-span-5 flex items-center">
                        <div className="relative w-full h-2 bg-[#232327] rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 left-1/2 w-px bg-white/[0.15] z-10"
                            aria-hidden="true"
                          />
                          {ev.percentile !== null && (
                            <div
                              className={`h-full rounded-full ${style.bar} transition-[width] duration-200`}
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Right Value + FotMob-style Percentile Pill */}
                      <div className="col-span-3 flex items-center justify-end gap-3 font-mono tabular-nums">
                        <span className="text-[13px] text-[#EDEDED]">{ev.formattedValue}</span>
                        <span
                          className={`inline-flex items-center justify-center min-w-[30px] h-6 px-1.5 rounded-md text-xs font-medium ${style.badge}`}
                        >
                          {ev.percentile !== null ? ev.percentile : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Right Column: Tactical Radar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#19191C] border border-white/[0.08] rounded-2xl p-6 flex-1 flex flex-col justify-between">
            <div className="pb-3 border-b border-white/[0.08] mb-3">
              <h2 className="text-sm font-medium text-[#EDEDED]">Shape Profile</h2>
              <p className="text-xs text-[#9898A0] mt-1">
                Core {player.roleGroup} percentile polygon (dashed ring = 50th)
              </p>
            </div>
            <RadarPlot points={radarPoints} nameA={player.lastName} />
          </div>
        </div>
      </div>

      {/* Positional Peers Table for instant 1v1 pivoting */}
      {peers.length > 0 && (
        <div className="bg-[#19191C] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[#EDEDED]">
                Top {player.roleGroup} Peers to Benchmark Against
              </h2>
              <p className="text-xs text-[#9898A0] mt-0.5">
                Select any peer to inspect their dossier or launch a direct 1v1 Verdict
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {peers.map((peer) => (
              <div
                key={peer.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#232327]/70 transition-colors duration-150"
              >
                <button
                  type="button"
                  onClick={() => onSelectPlayer(peer)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-sm font-medium text-[#EDEDED] hover:underline truncate">
                    {peer.name}
                  </div>
                  <div className="text-xs text-[#9898A0] mt-0.5 truncate">
                    {peer.squad} · {peer.league} ·{' '}
                    <span className="font-mono tabular-nums">{peer.minutes}&apos;</span>
                  </div>
                </button>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:flex items-center gap-4 font-mono text-xs tabular-nums text-[#9898A0]">
                    {player.roleGroup === 'GK' ? (
                      <>
                        <span>Save% {peer.metrics['Save%']?.toFixed(1) ?? '—'}%</span>
                        <span>GA90 {peer.metrics['GA90']?.toFixed(2) ?? '—'}</span>
                      </>
                    ) : player.roleGroup === 'DEF' ? (
                      <>
                        <span>TklW {peer.metrics['TklW'] ?? 0}</span>
                        <span>Int {peer.metrics['Int'] ?? 0}</span>
                      </>
                    ) : (
                      <>
                        <span>G {peer.metrics['Gls'] ?? 0}</span>
                        <span>A {peer.metrics['Ast'] ?? 0}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onComparePlayer(player, peer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#EDEDED] bg-[#232327] hover:bg-[#2B2B31] border border-white/[0.08] hover:border-[#10B981]/50 hover:text-[#10B981] rounded-lg transition-colors duration-150 whitespace-nowrap"
                  >
                    <Scale className="w-3.5 h-3.5" strokeWidth={1.5} />
                    1v1 Verdict
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
