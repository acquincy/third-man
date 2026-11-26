import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, Scale, X } from 'lucide-react';
import type { Player } from '../types/player';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  onSelectDossier: (player: Player) => void;
  onAssignCompare: (player: Player, slot: 'A' | 'B') => void;
}

export function CommandSearchModal({
  isOpen,
  onClose,
  players,
  onSelectDossier,
  onAssignCompare,
}: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show top high-minute standout players when empty
      return [...players]
        .filter((p) => p.minutes >= 450)
        .sort((a, b) => (b.metrics['G+A'] ?? 0) - (a.metrics['G+A'] ?? 0))
        .slice(0, 12);
    }
    return players
      .filter((p) => {
        const hay = `${p.name} ${p.squad} ${p.league} ${p.nation} ${p.roleGroup}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return b.minutes - a.minutes;
      })
      .slice(0, 14);
  }, [players, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(results.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        onSelectDossier(results[activeIndex]);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, activeIndex, onClose, onSelectDossier]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-[#0B0B0D]/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick player search"
    >
      <div
        className="w-full max-w-2xl bg-[#19191C] border border-white/[0.1] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.55)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-[#7E7E85] shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, clubs, or leagues"
            className="w-full bg-transparent text-sm text-[#EDEDED] placeholder-[#7E7E85] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#9898A0] hover:text-[#EDEDED] rounded-lg transition-colors duration-150"
            aria-label="Close search"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-white/[0.06]">
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#9898A0]">
              No players matching “{query}” in the 2026/27 dataset
            </div>
          ) : (
            results.map((player, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={player.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 ${
                    isSelected ? 'bg-[#232327]' : 'bg-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDossier(player);
                      onClose();
                    }}
                    className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 py-0.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#EDEDED] truncate">
                        {player.name}
                      </div>
                      <div className="text-xs text-[#9898A0] truncate mt-0.5">
                        {player.squad} · {player.league} · {player.roleGroup}
                      </div>
                    </div>
                    <div className="font-mono text-xs tabular-nums text-[#9898A0] shrink-0">
                      {player.minutes.toLocaleString('en-US')}&apos;
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onAssignCompare(player, 'A');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-mono text-[#9898A0] hover:text-[#10B981] bg-[#111113] border border-white/[0.08] hover:border-[#10B981]/50 rounded-lg transition-colors duration-150 whitespace-nowrap"
                      title="Compare as Player A"
                    >
                      Set A
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAssignCompare(player, 'B');
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-mono text-[#9898A0] hover:text-[#EDEDED] bg-[#111113] border border-white/[0.08] hover:border-white/[0.16] rounded-lg transition-colors duration-150 whitespace-nowrap"
                      title="Compare as Player B"
                    >
                      Set B
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDossier(player);
                        onClose();
                      }}
                      className="p-1.5 text-[#9898A0] hover:text-[#EDEDED] rounded-lg transition-colors duration-150"
                      title="Open Dossier"
                    >
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08] bg-[#141417] text-xs text-[#7E7E85]">
          <span className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Press Enter for Dossier, or assign directly to 1v1 Verdict</span>
          </span>
          <kbd className="font-mono text-[11px] bg-[#19191C] border border-white/[0.08] px-1.5 py-0.5 rounded text-[#9898A0]">
            Esc
          </kbd>
        </div>
      </div>
    </div>
  );
}
