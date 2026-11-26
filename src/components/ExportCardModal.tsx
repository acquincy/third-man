import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Grid, X } from 'lucide-react';
import {
  renderCardToCanvas,
  type CardAspectRatio,
  type ExportCardPayload,
} from '../lib/cardRenderer';

interface ExportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ExportCardPayload | null;
}

export function ExportCardModal({ isOpen, onClose, payload }: ExportCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<CardAspectRatio>('16:9');
  const [customHeadline, setCustomHeadline] = useState('');
  const [showGridTexture, setShowGridTexture] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!isOpen || !payload) return;
    setCustomHeadline(
      payload.kind === 'dossier'
        ? `PLAYER DOSSIER · ${payload.profile.roleGroup} PERCENTILES`
        : '1V1 VERDICT · HEAD-TO-HEAD COMPARISON'
    );
    setCopied(false);
    setDownloaded(false);
  }, [isOpen, payload]);

  useEffect(() => {
    if (!isOpen || !payload || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);

    const mergedPayload: ExportCardPayload = {
      ...payload,
      customHeadline,
      showGridTexture,
    };

    renderCardToCanvas(canvasRef.current, mergedPayload, aspect).finally(() => {
      if (!cancelled) setRendering(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, payload, aspect, customHeadline, showGridTexture]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !payload) return null;

  const fileSlug =
    payload.kind === 'dossier'
      ? `third-man-${payload.profile.player.lastName.toLowerCase().replace(/\s+/g, '-')}-dossier`
      : `third-man-${payload.playerA.lastName.toLowerCase().replace(/\s+/g, '-')}-vs-${payload.playerB.lastName.toLowerCase().replace(/\s+/g, '-')}`;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${fileSlug}-${aspect === '16:9' ? 'landscape' : 'portrait'}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2200);
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
      );
      if (blob && navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B0B0D]/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Export PNG stat card"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-[#19191C] border border-white/[0.1] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="font-editorial text-xl font-medium text-[#EDEDED]">
              Export Graphic for X
            </h2>
            <p className="text-xs text-[#9898A0] mt-0.5">
              High-DPI 2x PNG rendered directly from 2026/27 season statistics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#9898A0] hover:text-[#EDEDED] rounded-lg transition-colors duration-150"
            aria-label="Close export studio"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Canvas Preview Stage */}
          <div className="lg:col-span-8 p-6 bg-[#111113] flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/[0.08] min-h-[360px]">
            <div className="relative w-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className={`border border-white/[0.08] rounded-lg transition-opacity duration-150 ${
                  rendering ? 'opacity-60' : 'opacity-100'
                } ${
                  aspect === '16:9'
                    ? 'w-full max-w-[660px] h-auto'
                    : 'h-[480px] w-auto max-w-full'
                }`}
              />
            </div>
          </div>

          {/* Controls Panel */}
          <div className="lg:col-span-4 p-6 flex flex-col justify-between gap-6 bg-[#19191C]">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-[#9898A0] mb-2">
                  Format & Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#111113] border border-white/[0.08] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAspect('16:9')}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                      aspect === '16:9'
                        ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[#9898A0] hover:text-[#EDEDED]'
                    }`}
                  >
                    16:9 Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspect('4:5')}
                    className={`px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                      aspect === '4:5'
                        ? 'bg-[#232327] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[#9898A0] hover:text-[#EDEDED]'
                    }`}
                  >
                    4:5 Portrait
                  </button>
                </div>
                <p className="font-mono text-xs text-[#7E7E85] mt-2 tabular-nums">
                  Output: {aspect === '16:9' ? '2400 × 1350 px' : '2160 × 2700 px'} PNG
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-kicker-input"
                  className="block text-xs font-medium text-[#9898A0] mb-2"
                >
                  Masthead Caption
                </label>
                <input
                  id="card-kicker-input"
                  type="text"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  maxLength={54}
                  placeholder="Custom editorial kicker"
                  className="w-full h-9 px-3 bg-[#111113] border border-white/[0.08] focus:border-[#10B981] rounded-lg text-xs font-mono text-[#EDEDED] placeholder-[#7E7E85] focus:outline-none transition-colors duration-150"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-y border-white/[0.08]">
                <span className="flex items-center gap-2 text-xs text-[#EDEDED]">
                  <Grid className="w-4 h-4 text-[#9898A0]" strokeWidth={1.5} />
                  Swiss Hairline Grid
                </span>
                <button
                  type="button"
                  onClick={() => setShowGridTexture((v) => !v)}
                  className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors duration-150 ${
                    showGridTexture
                      ? 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/12'
                      : 'border-white/[0.08] text-[#9898A0] bg-[#111113]'
                  }`}
                >
                  {showGridTexture ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-[#EDEDED] hover:bg-white text-[#111113] text-xs font-medium rounded-lg transition-colors duration-150 whitespace-nowrap"
              >
                {downloaded ? (
                  <>
                    <Check className="w-4 h-4" strokeWidth={1.5} />
                    Saved PNG
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                    Download PNG
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-[#232327] hover:bg-[#2C2C32] text-[#EDEDED] border border-white/[0.08] text-xs font-medium rounded-lg transition-colors duration-150 whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#9898A0]" strokeWidth={1.5} />
                    Copy Image to Clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
