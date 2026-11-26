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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-[#09090B]/75 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick player search"
    >
      <div
        className="w-full max-w-2xl bg-[#111216] border border-[#1F2229] rounded-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1F2229]">
          <Search className="w-4 h-4 text-[#8A8F98] shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player, club, league, or role..."
            className="w-full bg-transparent text-sm text-[#F4F4F5] placeholder-[#8A8F98] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8A8F98] hover:text-[#F4F4F5] transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-[#1F2229]/70">
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#8A8F98]">
              No players matching “{query}” in the 2026/27 dataset.
            </div>
          ) : (
            results.map((player, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={player.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between gap-4 px-4 py-2.5 transition-colors ${
                    isSelected ? 'bg-[#171920]' : 'bg-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDossier(player);
                      onClose();
                    }}
                    className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 py-1"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F4F4F5] truncate">
                        {player.name}
                      </div>
                      <div className="text-xs text-[#8A8F98] truncate mt-0.5">
                        {player.squad} · {player.league} · {player.roleGroup}
                      </div>
                    </div>
                    <div className="font-mono text-xs tabular-nums text-[#8A8F98] shrink-0">
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
                      className="px-2 py-1 text-[11px] font-mono text-[#8A8F98] hover:text-[#10B981] border border-[#1F2229] hover:border-[#10B981]/50 rounded-sm transition-colors whitespace-nowrap"
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
                      className="px-2 py-1 text-[11px] font-mono text-[#8A8F98] hover:text-[#F4F4F5] border border-[#1F2229] hover:border-[#3A3F4B] rounded-sm transition-colors whitespace-nowrap"
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
                      className="p-1.5 text-[#8A8F98] hover:text-[#F4F4F5] transition-colors"
                      title="Open Dossier"
                    >
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1F2229] bg-[#0D0E12] text-[11px] text-[#8A8F98]">
          <span className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Press Enter for Dossier, or assign directly to 1v1 Verdict</span>
          </span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
