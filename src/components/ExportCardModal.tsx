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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#09090B]/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Export PNG stat card"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-[#111216] border border-[#1F2229] rounded-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2229]">
          <div>
            <h2 className="font-editorial text-xl font-medium text-[#F4F4F5]">
              Export Graphic for X
            </h2>
            <p className="text-xs text-[#8A8F98] mt-0.5">
              High-DPI 2x PNG rendered directly from 2026/27 season statistics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#8A8F98] hover:text-[#F4F4F5] transition-colors"
            aria-label="Close export studio"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Canvas Preview Stage */}
          <div className="lg:col-span-8 p-6 bg-[#09090B] flex items-center justify-center border-b lg:border-b-0 lg:border-r border-[#1F2229] min-h-[360px]">
            <div className="relative w-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className={`border border-[#1F2229] transition-opacity duration-150 ${
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
          <div className="lg:col-span-4 p-6 flex flex-col justify-between gap-6 bg-[#111216]">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-[#8A8F98] mb-2">
                  Format & Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#09090B] border border-[#1F2229] rounded-sm">
                  <button
                    type="button"
                    onClick={() => setAspect('16:9')}
                    className={`px-3 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                      aspect === '16:9'
                        ? 'bg-[#1D2028] text-[#F4F4F5]'
                        : 'text-[#8A8F98] hover:text-[#F4F4F5]'
                    }`}
                  >
                    16:9 Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspect('4:5')}
                    className={`px-3 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                      aspect === '4:5'
                        ? 'bg-[#1D2028] text-[#F4F4F5]'
                        : 'text-[#8A8F98] hover:text-[#F4F4F5]'
                    }`}
                  >
                    4:5 Portrait
                  </button>
                </div>
                <p className="font-mono text-[11px] text-[#8A8F98] mt-2 tabular-nums">
                  Output: {aspect === '16:9' ? '2400 × 1350 px' : '2160 × 2700 px'} PNG
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-kicker-input"
                  className="block text-xs font-medium text-[#8A8F98] mb-2"
                >
                  Masthead Caption
                </label>
                <input
                  id="card-kicker-input"
                  type="text"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  maxLength={54}
                  placeholder="Custom editorial kicker..."
                  className="w-full px-3 py-2 bg-[#09090B] border border-[#1F2229] focus:border-[#10B981] rounded-sm text-xs font-mono text-[#F4F4F5] placeholder-[#5A5F6B] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-y border-[#1F2229]">
                <span className="flex items-center gap-2 text-xs text-[#F4F4F5]">
                  <Grid className="w-3.5 h-3.5 text-[#8A8F98]" strokeWidth={1.5} />
                  Swiss Hairline Grid
                </span>
                <button
                  type="button"
                  onClick={() => setShowGridTexture((v) => !v)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors ${
                    showGridTexture
                      ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10'
                      : 'border-[#1F2229] text-[#8A8F98] bg-[#09090B]'
                  }`}
                >
                  {showGridTexture ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-[#1F2229]">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F4F4F5] hover:bg-white text-[#09090B] text-xs font-semibold rounded-sm transition-colors whitespace-nowrap"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#09090B] hover:bg-[#171920] text-[#F4F4F5] border border-[#1F2229] text-xs font-medium rounded-sm transition-colors whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#8A8F98]" strokeWidth={1.5} />
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
