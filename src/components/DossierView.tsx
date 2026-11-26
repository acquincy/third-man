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
    text: 'text-[#10B981]',
    label: 'Elite',
  },
  average: {
    bar: 'bg-[#F59E0B]',
    text: 'text-[#F59E0B]',
    label: 'Mid',
  },
  below: {
    bar: 'bg-[#F43F5E]',
    text: 'text-[#F43F5E]',
    label: 'Low',
  },
  none: {
    bar: 'bg-[#2C303A]',
    text: 'text-[#8A8F98]',
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

  return (
    <section aria-label={`Player Dossier for ${player.name}`} className="space-y-6">
      {/* Top Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToIndex}
          className="inline-flex items-center gap-1.5 text-xs text-[#8A8F98] hover:text-[#F4F4F5] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Back to Index
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8A8F98] hover:text-[#F4F4F5] bg-[#111216] border border-[#1F2229] hover:border-[#333845] rounded-sm transition-colors whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
            Switch Player
          </button>
          <button
            type="button"
            onClick={() => onComparePlayer(player)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#F4F4F5] bg-[#111216] hover:bg-[#191C24] border border-[#1F2229] hover:border-[#3A3F4B] rounded-sm transition-colors whitespace-nowrap"
          >
            <Scale className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={1.5} />
            Compare This Player
          </button>
          <button
            type="button"
            disabled={!profile}
            onClick={() => {
              if (!profile) return;
              onExportCard({ kind: 'dossier', profile });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#09090B] bg-[#F4F4F5] hover:bg-white rounded-sm transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Export Card (PNG)
          </button>
        </div>
      </div>

      {/* Editorial Player Masthead */}
      <div className="bg-[#111216] border border-[#1F2229] rounded-sm p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="min-w-0">
            {player.firstName && (
              <div className="text-sm text-[#8A8F98] font-medium mb-1">
                {player.firstName}
              </div>
            )}
            <h1 className="font-editorial text-4xl sm:text-5xl font-medium tracking-tight text-[#F4F4F5] leading-[1.05]">
              {player.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#8A8F98] mt-3">
              <span className="text-[#F4F4F5] font-medium">{player.squad}</span>
              <span aria-hidden="true">·</span>
              <span>{player.league}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[#F4F4F5]">
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

          {/* Quantitative Appearance Strip */}
          <div className="grid grid-cols-4 gap-5 sm:gap-7 pt-4 lg:pt-0 border-t lg:border-t-0 border-[#1F2229] shrink-0">
            <div>
              <div className="text-[11px] font-mono text-[#8A8F98]">Minutes</div>
              <div className="font-mono text-xl font-semibold text-[#F4F4F5] tabular-nums mt-0.5">
                {player.minutes.toLocaleString('en-US')}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-[#8A8F98]">90s</div>
              <div className="font-mono text-xl font-semibold text-[#F4F4F5] tabular-nums mt-0.5">
                {player.nineties.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-[#8A8F98]">Matches</div>
              <div className="font-mono text-xl font-semibold text-[#F4F4F5] tabular-nums mt-0.5">
                {player.matchesPlayed}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-[#8A8F98]">Starts</div>
              <div className="font-mono text-xl font-semibold text-[#F4F4F5] tabular-nums mt-0.5">
                {player.starts}
              </div>
            </div>
          </div>
        </div>

        {/* Low-sample notice if player is below current minMinutes benchmark */}
        {profile && !profile.meetsThreshold && (
          <div className="mt-5 pt-4 border-t border-[#1F2229] text-xs text-[#F59E0B] flex items-center justify-between gap-4">
            <span>
              Sample advisory: {player.name} has {player.minutes} minutes played, below the active{' '}
              {minMinutes}+ minute peer cohort. Percentiles are projected against {profile.peerCount}{' '}
              qualifying {player.roleGroup} peers.
            </span>
          </div>
        )}
      </div>

      {/* Narrative Callout Strip (xG/xA deltas if present, else verified conversion/impact metrics) */}
      {callouts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1F2229] border border-[#1F2229] rounded-sm overflow-hidden">
          {callouts.map((item) => {
            const accent =
              item.sentiment === 'elite'
                ? 'text-[#10B981]'
                : item.sentiment === 'below'
                  ? 'text-[#F43F5E]'
                  : item.sentiment === 'average'
                    ? 'text-[#F59E0B]'
                    : 'text-[#F4F4F5]';
            return (
              <div key={item.label} className="bg-[#111216] p-5 flex flex-col justify-between">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-[#8A8F98] font-medium">{item.label}</span>
                  <span className={`font-mono text-lg font-semibold tabular-nums ${accent}`}>
                    {item.value}
                  </span>
                </div>
                <p className="text-xs text-[#8A8F98] mt-2 leading-relaxed">{item.context}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Analytical Grid: Role-Aware Percentile Bars + Swiss Radar Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Percentile Breakdown Bars */}
        <div className="lg:col-span-8 bg-[#111216] border border-[#1F2229] rounded-sm p-6 flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[#1F2229]">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F4F5]">
                Positional Percentile Breakdown
              </h2>
              <p className="text-xs text-[#8A8F98] mt-0.5">
                Ranked 0–99 against{' '}
                <span className="font-mono text-[#F4F4F5] tabular-nums">
                  {profile?.peerCount ?? '—'}
                </span>{' '}
                {player.roleGroup} peers ({minMinutes > 0 ? `${minMinutes}+ mins` : 'all mins'}) ·{' '}
                {mode === 'per90' ? 'Per 90 rates' : 'Season totals'}
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#8A8F98] tabular-nums">
              {mode === 'per90' ? 'PER 90' : 'TOTAL'} · PCTL
            </div>
          </div>

          <div className="mt-2 divide-y divide-[#1F2229]/60 flex-1">
            {loading || !profile
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="py-3.5">
                    <div className="h-4 bg-[#181A20] rounded-sm animate-pulse" />
                  </div>
                ))
              : profile.evaluations.map((ev) => {
                  const style = TIER_STYLES[ev.tier];
                  const pct = ev.percentile ?? 0;

                  return (
                    <div
                      key={ev.metric.id}
                      className="py-3 grid grid-cols-12 items-center gap-3 group"
                      title={ev.metric.description}
                    >
                      <div className="col-span-5 sm:col-span-4 min-w-0">
                        <div className="text-[13px] font-medium text-[#F4F4F5] truncate">
                          {ev.metric.label}
                        </div>
                        <div className="text-[11px] text-[#8A8F98] font-mono">
                          {ev.metric.lowerIsBetter ? 'Lower is better' : ev.metric.shortLabel}
                        </div>
                      </div>

                      {/* Horizontal Percentile Bar with 50th median tick */}
                      <div className="col-span-4 sm:col-span-5 flex items-center">
                        <div className="relative w-full h-2.5 bg-[#181A20] overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 left-1/2 w-px bg-[#2C303A] z-10"
                            aria-hidden="true"
                          />
                          {ev.percentile !== null && (
                            <div
                              className={`h-full ${style.bar} transition-transform duration-200 origin-left`}
                              style={{ width: `${Math.max(3, pct)}%` }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Right Value + Exact Percentile */}
                      <div className="col-span-3 flex items-baseline justify-end gap-3 font-mono tabular-nums">
                        <span className="text-[13px] text-[#F4F4F5]">{ev.formattedValue}</span>
                        <span className={`text-xs font-semibold w-8 text-right ${style.text}`}>
                          {ev.percentile !== null ? ev.percentile : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Right Column: Tactical Radar & Role Peers */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#111216] border border-[#1F2229] rounded-sm p-6 flex-1 flex flex-col justify-between">
            <div className="pb-3 border-b border-[#1F2229] mb-3">
              <h2 className="text-sm font-semibold text-[#F4F4F5]">Shape Profile</h2>
              <p className="text-xs text-[#8A8F98] mt-0.5">
                Core {player.roleGroup} percentile polygon (dashed ring = 50th)
              </p>
            </div>
            <RadarPlot points={radarPoints} nameA={player.lastName} />
          </div>
        </div>
      </div>

      {/* Positional Peers Table for instant 1v1 pivoting */}
      {peers.length > 0 && (
        <div className="bg-[#111216] border border-[#1F2229] rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1F2229] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F4F5]">
                Top {player.roleGroup} Peers to Benchmark Against
              </h2>
              <p className="text-xs text-[#8A8F98] mt-0.5">
                Select any peer to inspect their dossier or launch a direct 1v1 Verdict
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#1F2229]/70">
            {peers.map((peer) => (
              <div
                key={peer.id}
                className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-[#16181E] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectPlayer(peer)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-sm font-medium text-[#F4F4F5] hover:underline truncate">
                    {peer.name}
                  </div>
                  <div className="text-xs text-[#8A8F98] mt-0.5 truncate">
                    {peer.squad} · {peer.league} ·{' '}
                    <span className="font-mono tabular-nums">{peer.minutes}&apos;</span>
                  </div>
                </button>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:flex items-center gap-4 font-mono text-xs tabular-nums text-[#8A8F98]">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4F4F5] border border-[#1F2229] hover:border-[#10B981]/60 hover:text-[#10B981] rounded-sm transition-colors whitespace-nowrap"
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
