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
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col">
      {/* Compact Sticky Editorial Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 bg-[#09090B]/88 backdrop-blur-md border-b border-[#1F2229]">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Minimal Typographic Wordmark + Pitch Angle Mark */}
          <BrandMark onClick={() => setActiveTab('index')} />

          {/* Center: Clean View Switcher Tabs */}
          <nav
            aria-label="Primary sections"
            className="flex items-center gap-5 sm:gap-7 h-full"
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
                  className={`relative h-full inline-flex items-center text-xs sm:text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F4F4F5]'
                      : 'text-[#8A8F98] hover:text-[#F4F4F5]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#10B981]"
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
              className="hidden sm:inline-flex items-center p-0.5 bg-[#111216] border border-[#1F2229] rounded-sm"
              role="group"
              aria-label="Stat calculation mode"
            >
              <button
                type="button"
                onClick={() => setMode('per90')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-sm transition-colors whitespace-nowrap ${
                  mode === 'per90'
                    ? 'bg-[#1F2229] text-[#F4F4F5]'
                    : 'text-[#8A8F98] hover:text-[#F4F4F5]'
                }`}
              >
                Per 90
              </button>
              <button
                type="button"
                onClick={() => setMode('total')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-sm transition-colors whitespace-nowrap ${
                  mode === 'total'
                    ? 'bg-[#1F2229] text-[#F4F4F5]'
                    : 'text-[#8A8F98] hover:text-[#F4F4F5]'
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
              className="hidden md:block px-2.5 py-1.5 bg-[#111216] border border-[#1F2229] focus:border-[#10B981] rounded-sm text-[11px] font-mono text-[#F4F4F5] focus:outline-none cursor-pointer"
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
              className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#111216] hover:bg-[#171920] border border-[#1F2229] hover:border-[#333845] rounded-sm text-xs text-[#8A8F98] hover:text-[#F4F4F5] transition-colors whitespace-nowrap shrink-0"
              aria-label="Quick search players (Command K)"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden sm:inline font-mono text-[10px] text-[#8A8F98] border border-[#262933] px-1 py-0.5 rounded-xs leading-none">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Secondary Control Strip (keeps header single-row on narrow screens) */}
      <div className="sm:hidden border-b border-[#1F2229] bg-[#0D0E12] px-4 py-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center p-0.5 bg-[#111216] border border-[#1F2229] rounded-sm">
          <button
            type="button"
            onClick={() => setMode('per90')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-sm ${
              mode === 'per90' ? 'bg-[#1F2229] text-[#F4F4F5]' : 'text-[#8A8F98]'
            }`}
          >
            Per 90
          </button>
          <button
            type="button"
            onClick={() => setMode('total')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-sm ${
              mode === 'total' ? 'bg-[#1F2229] text-[#F4F4F5]' : 'text-[#8A8F98]'
            }`}
          >
            Totals
          </button>
        </div>
        <select
          value={minMinutes}
          onChange={(e) => setMinMinutes(Number(e.target.value))}
          aria-label="Minimum minutes threshold"
          className="px-2.5 py-1 bg-[#111216] border border-[#1F2229] rounded-sm text-[11px] font-mono text-[#F4F4F5]"
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
          <div className="space-y-4 py-12">
            <div className="h-8 w-48 bg-[#111216] border border-[#1F2229] rounded-sm animate-pulse" />
            <div className="h-96 w-full bg-[#111216] border border-[#1F2229] rounded-sm animate-pulse" />
          </div>
        ) : error || !metadata ? (
          <div className="bg-[#111216] border border-[#1F2229] rounded-sm p-8 text-center max-w-lg mx-auto my-12">
            <h2 className="font-editorial text-xl text-[#F4F4F5]">Dataset Unavailable</h2>
            <p className="text-xs text-[#8A8F98] mt-2">{error || 'Unable to parse season CSV.'}</p>
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
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 bg-[#111216]/95 backdrop-blur-md border border-[#10B981]/50 rounded-sm flex items-center gap-4 max-w-[92vw]">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Scale className="w-3.5 h-3.5 text-[#10B981] shrink-0" strokeWidth={1.5} />
            <span className="text-[#F4F4F5] font-medium truncate">{stagedPlayer.name}</span>
            <span className="text-[#8A8F98] hidden sm:inline whitespace-nowrap">
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
              className="px-2.5 py-1 text-[11px] font-semibold bg-[#10B981] text-[#09090B] rounded-sm hover:bg-[#14C98E] transition-colors whitespace-nowrap"
            >
              Open Verdict
            </button>
            <button
              type="button"
              onClick={() => setStagedPlayer(null)}
              className="p-1 text-[#8A8F98] hover:text-[#F4F4F5]"
              aria-label="Clear compare staging"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#1F2229] py-4 px-4 sm:px-6 text-[11px] text-[#8A8F98]">
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
