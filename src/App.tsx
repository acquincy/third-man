import { useCallback, useEffect, useState } from 'react';
import { Search, Scale, X } from 'lucide-react';
import { BrandMark } from './components/BrandMark';
import { CommandSearchModal } from './components/CommandSearchModal';
import { DossierView } from './components/DossierView';
import { ExportCardModal } from './components/ExportCardModal';
import { IndexView } from './components/IndexView';
import { VerdictView } from './components/VerdictView';
import type { ExportCardPayload } from './lib/cardRenderer';
import {
  getAvailableMetrics,
  getCuratedMatchups,
  getFilterMetadata,
  loadDataset,
} from './services/playerRepository';
import type {
  CuratedMatchup,
  FilterMetadata,
  MetricDefinition,
  Player,
  StatMode,
} from './types/player';

type ActiveTab = 'index' | 'dossier' | 'verdict';

const MIN_MINUTES_OPTIONS = [
  { value: 450, label: '450+ mins' },
  { value: 700, label: '700+ mins' },
  { value: 900, label: '900+ mins' },
  { value: 0, label: 'All mins' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('index');
  const [mode, setMode] = useState<StatMode>('per90');
  const [minMinutes, setMinMinutes] = useState<number>(450);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [metricsById, setMetricsById] = useState<Record<string, MetricDefinition>>({});
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null);
  const [matchups, setMatchups] = useState<CuratedMatchup[]>([]);
  const [hasXG, setHasXG] = useState(false);
  const [hasXA, setHasXA] = useState(false);

  const [selectedDossierPlayer, setSelectedDossierPlayer] = useState<Player | null>(null);
  const [playerA, setPlayerA] = useState<Player | null>(null);
  const [playerB, setPlayerB] = useState<Player | null>(null);

  // Subtle staged compare toast when queueing from Index
  const [stagedPlayer, setStagedPlayer] = useState<Player | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportCardPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap real CSV dataset via repository
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [dataset, metricInfo, filterMeta, presetMatchups] = await Promise.all([
          loadDataset(),
          getAvailableMetrics(),
          getFilterMetadata(),
          getCuratedMatchups(),
        ]);

        if (cancelled) return;

        setAllPlayers(dataset.players);
        setMetricsById(metricInfo.metricsById);
        setHasXG(metricInfo.hasXG);
        setHasXA(metricInfo.hasXA);
        setMetadata(filterMeta);
        setMatchups(presetMatchups);

        // Default Dossier & Verdict to real marquee players from the attached CSV
        const firstMatchup = presetMatchups[0];
        const defaultA =
          (firstMatchup && dataset.players.find((p) => p.id === firstMatchup.playerAId)) ||
          dataset.players.find((p) => p.minutes >= 450) ||
          dataset.players[0] ||
          null;
        const defaultB =
          (firstMatchup && dataset.players.find((p) => p.id === firstMatchup.playerBId)) ||
          dataset.players.find((p) => p.id !== defaultA?.id && p.minutes >= 450) ||
          dataset.players[1] ||
          null;

        setSelectedDossierPlayer(defaultA);
        setPlayerA(defaultA);
        setPlayerB(defaultB);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load player statistics dataset.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global Cmd/Ctrl + K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenDossier = useCallback((player: Player) => {
    setSelectedDossierPlayer(player);
    setActiveTab('dossier');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleQueueCompareFromIndex = useCallback(
    (player: Player) => {
      if (!stagedPlayer) {
        setStagedPlayer(player);
        setPlayerA(player);
        return;
      }
      if (stagedPlayer.id === player.id) {
        setStagedPlayer(null);
        return;
      }
      setPlayerA(stagedPlayer);
      setPlayerB(player);
      setStagedPlayer(null);
      setActiveTab('verdict');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [stagedPlayer]
  );

  const handleCompareFromDossier = useCallback(
    (player: Player, opponent?: Player) => {
      setPlayerA(player);
      if (opponent) {
        setPlayerB(opponent);
      } else if (playerB && playerB.id === player.id) {
        // Pick a strong peer in the same role so we don't compare a player against themselves
        const alt =
          allPlayers.find(
            (p) => p.id !== player.id && p.roleGroup === player.roleGroup && p.minutes >= 450
          ) || allPlayers.find((p) => p.id !== player.id);
        if (alt) setPlayerB(alt);
      }
      setStagedPlayer(null);
      setActiveTab('verdict');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [playerB, allPlayers]
  );

  const handleAssignCompareSlot = useCallback((player: Player, slot: 'A' | 'B') => {
    if (slot === 'A') setPlayerA(player);
    else setPlayerB(player);
    setStagedPlayer(null);
    setActiveTab('verdict');
  }, []);

  const handleSwapPlayers = useCallback(() => {
    setPlayerA((prevA) => {
      setPlayerB(prevA);
      return playerB;
    });
  }, [playerB]);

  return (
    <div className="min-h-screen bg-[#111113] text-[#EDEDED] flex flex-col">
      {/* Compact Sticky Editorial Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 bg-[#111113]/92 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Minimal Typographic Wordmark + Pitch Angle Mark */}
          <BrandMark onClick={() => setActiveTab('index')} />

          {/* Center: Clean View Switcher Tabs */}
          <nav
            aria-label="Primary sections"
            className="flex items-center gap-1 sm:gap-2 h-full"
          >
            {(
              [
                { id: 'index', label: 'Index' },
                { id: 'dossier', label: 'Dossier' },
                { id: 'verdict', label: 'Verdict' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-full px-3 sm:px-4 inline-flex items-center text-[13px] sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/60 rounded-lg ${
                    isActive
                      ? 'text-[#EDEDED]'
                      : 'text-[#9898A0] hover:text-[#EDEDED]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#10B981]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Per 90 / Totals Toggle + Min. Minutes + Cmd/Ctrl+K Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Per 90 / Totals Segmented Control */}
            <div
              className="hidden sm:inline-flex items-center p-1 bg-[#19191C] border border-white/[0.08] rounded-lg h-9"
              role="group"
              aria-label="Stat calculation mode"
            >
              <button
                type="button"
                onClick={() => setMode('per90')}
                className={`px-2.5 h-7 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                  mode === 'per90'
                    ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-[#9898A0] hover:text-[#EDEDED]'
                }`}
              >
                Per 90
              </button>
              <button
                type="button"
                onClick={() => setMode('total')}
                className={`px-2.5 h-7 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                  mode === 'total'
                    ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-[#9898A0] hover:text-[#EDEDED]'
                }`}
              >
                Totals
              </button>
            </div>

            {/* Min. Minutes Threshold Selector */}
            <select
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
              aria-label="Minimum minutes threshold"
              className="hidden md:block h-9 px-3 bg-[#19191C] border border-white/[0.08] focus:border-[#10B981] rounded-lg text-xs font-mono text-[#EDEDED] focus:outline-none cursor-pointer transition-colors duration-150"
            >
              {MIN_MINUTES_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Quick Cmd/Ctrl+K Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-3 bg-[#19191C] hover:bg-[#232327] border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-xs text-[#9898A0] hover:text-[#EDEDED] transition-colors duration-150 whitespace-nowrap shrink-0"
              aria-label="Quick search players (Command K)"
            >
              <Search className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden sm:inline font-mono text-[11px] text-[#9898A0] bg-[#111113] border border-white/[0.08] px-1.5 py-0.5 rounded leading-none">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Secondary Control Strip (keeps header single-row on narrow screens) */}
      <div className="sm:hidden border-b border-white/[0.08] bg-[#0F0F11] px-4 py-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center p-1 bg-[#19191C] border border-white/[0.08] rounded-lg">
          <button
            type="button"
            onClick={() => setMode('per90')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
              mode === 'per90' ? 'bg-[#232327] text-[#EDEDED]' : 'text-[#9898A0]'
            }`}
          >
            Per 90
          </button>
          <button
            type="button"
            onClick={() => setMode('total')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
              mode === 'total' ? 'bg-[#232327] text-[#EDEDED]' : 'text-[#9898A0]'
            }`}
          >
            Totals
          </button>
        </div>
        <select
          value={minMinutes}
          onChange={(e) => setMinMinutes(Number(e.target.value))}
          aria-label="Minimum minutes threshold"
          className="px-3 py-1.5 bg-[#19191C] border border-white/[0.08] rounded-lg text-xs font-mono text-[#EDEDED]"
        >
          {MIN_MINUTES_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="space-y-4 py-8">
            <div className="h-9 w-52 bg-[#19191C] border border-white/[0.08] rounded-lg" />
            <div className="h-96 w-full bg-[#19191C] border border-white/[0.08] rounded-2xl" />
          </div>
        ) : error || !metadata ? (
          <div className="bg-[#19191C] border border-white/[0.08] rounded-2xl p-8 text-center max-w-lg mx-auto my-12">
            <h2 className="font-editorial text-xl text-[#EDEDED]">Dataset Unavailable</h2>
            <p className="text-xs text-[#9898A0] mt-2">{error || 'Unable to parse season CSV.'}</p>
          </div>
        ) : (
          <>
            {activeTab === 'index' && (
              <IndexView
                mode={mode}
                minMinutes={minMinutes}
                metricsById={metricsById}
                metadata={metadata}
                compareQueueAId={stagedPlayer?.id ?? null}
                compareQueueBId={null}
                onOpenDossier={handleOpenDossier}
                onQueueCompare={handleQueueCompareFromIndex}
              />
            )}

            {activeTab === 'dossier' && selectedDossierPlayer && (
              <DossierView
                player={selectedDossierPlayer}
                mode={mode}
                minMinutes={minMinutes}
                metricsById={metricsById}
                hasXG={hasXG}
                hasXA={hasXA}
                onBackToIndex={() => setActiveTab('index')}
                onComparePlayer={handleCompareFromDossier}
                onSelectPlayer={handleOpenDossier}
                onOpenSearch={() => setSearchOpen(true)}
                onExportCard={(payload) => setExportPayload(payload)}
              />
            )}

            {activeTab === 'verdict' && playerA && playerB && (
              <VerdictView
                allPlayers={allPlayers}
                playerA={playerA}
                playerB={playerB}
                matchups={matchups}
                mode={mode}
                minMinutes={minMinutes}
                metricsById={metricsById}
                onSelectPlayerA={setPlayerA}
                onSelectPlayerB={setPlayerB}
                onSwapPlayers={handleSwapPlayers}
                onOpenDossier={handleOpenDossier}
                onExportCard={(payload) => setExportPayload(payload)}
              />
            )}
          </>
        )}
      </main>

      {/* Staged 1v1 Compare Floating Bar (when 1 player queued from Index) */}
      {stagedPlayer && activeTab === 'index' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 bg-[#19191C]/95 backdrop-blur-md border border-[#10B981]/50 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex items-center gap-4 max-w-[92vw]">
          <div className="flex items-center gap-2.5 text-xs min-w-0">
            <Scale className="w-4 h-4 text-[#10B981] shrink-0" strokeWidth={1.5} />
            <span className="text-[#EDEDED] font-medium truncate">{stagedPlayer.name}</span>
            <span className="text-[#9898A0] hidden sm:inline whitespace-nowrap">
              staged · select a second player to compare
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setStagedPlayer(null);
                setActiveTab('verdict');
              }}
              className="px-3 py-1.5 text-xs font-medium bg-[#10B981] text-[#111113] rounded-lg hover:bg-[#14C98E] transition-colors duration-150 whitespace-nowrap"
            >
              Open Verdict
            </button>
            <button
              type="button"
              onClick={() => setStagedPlayer(null)}
              className="p-1.5 text-[#9898A0] hover:text-[#EDEDED] rounded-lg transition-colors duration-150"
              aria-label="Clear compare staging"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/[0.08] py-4 px-4 sm:px-6 text-xs text-[#7E7E85]">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Third Man · Editorial Football Statistics</span>
          <span className="font-mono tabular-nums">
            {metadata
              ? `${metadata.totalPlayers.toLocaleString('en-US')} players · 5 European leagues · 2026/27`
              : '2026/27 Season Dataset'}
          </span>
        </div>
      </footer>

      {/* Modals */}
      <CommandSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        players={allPlayers}
        onSelectDossier={handleOpenDossier}
        onAssignCompare={handleAssignCompareSlot}
      />

      <ExportCardModal
        isOpen={exportPayload !== null}
        onClose={() => setExportPayload(null)}
        payload={exportPayload}
      />
    </div>
  );
}
