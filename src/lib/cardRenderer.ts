import type {
  MetricDefinition,
  MetricEvaluation,
  PercentileProfile,
  Player,
  StatMode,
} from '../types/player';
import { formatMetricValue, getMetricValue } from './statsEngine';

export type CardAspectRatio = '16:9' | '4:5';

export interface DossierCardPayload {
  kind: 'dossier';
  profile: PercentileProfile;
  customHeadline?: string;
  showGridTexture?: boolean;
}

export interface VerdictComparisonRow {
  metric: MetricDefinition;
  valA: number | null;
  valB: number | null;
  formattedA: string;
  formattedB: string;
  pctA: number | null;
  pctB: number | null;
  winner: 'A' | 'B' | 'tie' | 'none';
}

export interface VerdictCardPayload {
  kind: 'verdict';
  playerA: Player;
  playerB: Player;
  rows: VerdictComparisonRow[];
  winsA: number;
  winsB: number;
  ties: number;
  mode: StatMode;
  minMinutes: number;
  customHeadline?: string;
  showGridTexture?: boolean;
}

export type ExportCardPayload = DossierCardPayload | VerdictCardPayload;

const COLORS = {
  bg: '#09090B',
  surface: '#111216',
  surfaceAlt: '#14161C',
  hairline: '#1F2229',
  hairlineStrong: '#2C303A',
  ink: '#F4F4F5',
  muted: '#8A8F98',
  dim: '#5A5F6B',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  barMuted: '#323642',
  track: '#181A20',
};

function tierColor(pct: number | null): string {
  if (pct === null) return COLORS.barMuted;
  if (pct >= 75) return COLORS.emerald;
  if (pct >= 40) return COLORS.amber;
  return COLORS.rose;
}

function drawPitchAngleMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  // Outer pitch corner frame
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();

  // Third-man diagonal run vector (emerald accent)
  ctx.strokeStyle = COLORS.emerald;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.22, y + size * 0.88);
  ctx.lineTo(x + size * 0.62, y + size * 0.42);
  ctx.lineTo(x + size * 0.96, y + size * 0.56);
  ctx.stroke();

  // Subtle third-man terminal point
  ctx.fillStyle = COLORS.emerald;
  ctx.beginPath();
  ctx.arc(x + size * 0.96, y + size * 0.56, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSubtleGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)';
  ctx.lineWidth = 1;
  const step = 48;
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontTemplate: (size: number) => string,
  startSize: number,
  minSize: number
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = fontTemplate(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  ctx.font = fontTemplate(minSize);
  return minSize;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  padX: number,
  mode: StatMode,
  minMinutes: number,
  extraNote: string
) {
  const footerY = h - 46;
  ctx.strokeStyle = COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerY - 22);
  ctx.lineTo(w - padX, footerY - 22);
  ctx.stroke();

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  ctx.fillText(
    `2026/27 TOP-5 EUROPEAN LEAGUES  ·  ${mode === 'per90' ? 'PER 90' : 'SEASON TOTALS'}  ·  MIN ${minMinutes} MINS`,
    padX,
    footerY
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(extraNote, w - padX, footerY);
}

function drawMasthead(
  ctx: CanvasRenderingContext2D,
  w: number,
  padX: number,
  padY: number,
  kicker: string
) {
  drawPitchAngleMark(ctx, padX, padY + 2, 18);

  ctx.font = '600 19px "Fraunces", Georgia, serif';
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.fillText('THIRD MAN', padX + 28, padY + 18);

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'right';
  ctx.fillText(kicker.toUpperCase(), w - padX, padY + 16);

  ctx.strokeStyle = COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padY + 34);
  ctx.lineTo(w - padX, padY + 34);
  ctx.stroke();
}

function renderDossierCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  payload: DossierCardPayload
) {
  const { profile, customHeadline, showGridTexture = true } = payload;
  const { player, evaluations, mode, minMinutes, peerCount, roleGroup } = profile;
  const isPortrait = h > w;
  const padX = isPortrait ? 64 : 56;
  const padY = isPortrait ? 52 : 36;

  // Base matte obsidian background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (showGridTexture) {
    drawSubtleGrid(ctx, w, h);
  }

  // Outer hairline editorial frame
  ctx.strokeStyle = COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(16.5, 16.5, w - 33, h - 33);

  drawMasthead(
    ctx,
    w,
    padX,
    padY,
    customHeadline?.trim() || `PLAYER DOSSIER  ·  ${roleGroup} PERCENTILES`
  );

  // Header Identity Block
  const headerTop = padY + 64;
  if (player.firstName) {
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'left';
    ctx.fillText(player.firstName, padX, headerTop);
  }

  const surnameY = player.firstName ? headerTop + 48 : headerTop + 34;
  const maxNameW = isPortrait ? w - padX * 2 - 180 : w - padX * 2 - 320;
  fitText(
    ctx,
    player.lastName,
    maxNameW,
    (sz) => `600 ${sz}px "Fraunces", Georgia, serif`,
    isPortrait ? 62 : 52,
    30
  );
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.fillText(player.lastName, padX, surnameY);

  // Metadata row (unboxed editorial text)
  const metaParts = [
    player.squad,
    player.league,
    `${player.rawPos} (${roleGroup})`,
    player.nationCode,
    player.age ? `Age ${player.age}` : null,
  ].filter(Boolean);

  ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(metaParts.join('  ·  '), padX, surnameY + 28);

  // Right-side summary metrics (Minutes / 90s / Avg Percentile)
  const statRightX = w - padX;
  const summaryStats = [
    { label: 'MINUTES', value: player.minutes.toLocaleString('en-US') },
    { label: '90s', value: player.nineties.toFixed(1) },
    { label: 'MATCHES', value: `${player.matchesPlayed} (${player.starts} st)` },
  ];

  let cursorX = statRightX;
  for (let i = summaryStats.length - 1; i >= 0; i--) {
    const s = summaryStats[i];
    ctx.textAlign = 'right';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(s.label, cursorX, headerTop + 8);

    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(s.value, cursorX, headerTop + 34);
    cursorX -= isPortrait ? 124 : 138;
  }

  // Divider below identity
  const tableTop = surnameY + 54;
  ctx.strokeStyle = COLORS.hairline;
  ctx.beginPath();
  ctx.moveTo(padX, tableTop);
  ctx.lineTo(w - padX, tableTop);
  ctx.stroke();

  // Percentile Bars Section
  const bars = evaluations.slice(0, isPortrait ? 10 : 8);
  const availH = h - tableTop - 96;
  const rowGap = isPortrait ? 14 : 10;
  const rowH = Math.min(isPortrait ? 76 : 42, Math.floor((availH - 36) / Math.max(bars.length, 1)));

  // Column headers for bars
  const colHeaderY = tableTop + 26;
  const labelColW = isPortrait ? 250 : 230;
  const valColW = 105;
  const pctColW = 64;
  const barStartX = padX + labelColW;
  const barEndX = w - padX - valColW - pctColW - 24;
  const barW = Math.max(180, barEndX - barStartX);

  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'left';
  ctx.fillText('METRIC', padX, colHeaderY);
  ctx.fillText(`POSITIONAL PERCENTILE (vs ${peerCount} ${roleGroup}s)`, barStartX, colHeaderY);
  ctx.textAlign = 'right';
  ctx.fillText(mode === 'per90' ? 'PER 90' : 'TOTAL', w - padX - pctColW - 16, colHeaderY);
  ctx.fillText('PCTL', w - padX, colHeaderY);

  // Subtle vertical 50th percentile reference tick line
  const barsTopY = colHeaderY + 18;
  const barsBottomY = barsTopY + bars.length * rowH - 6;
  ctx.save();
  ctx.strokeStyle = COLORS.hairlineStrong;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(barStartX + barW * 0.5, barsTopY - 4);
  ctx.lineTo(barStartX + barW * 0.5, barsBottomY);
  ctx.stroke();
  ctx.restore();

  bars.forEach((ev: MetricEvaluation, idx: number) => {
    const y = barsTopY + idx * rowH;
    const centerY = y + (rowH - rowGap) / 2 + 5;

    // Metric label
    ctx.textAlign = 'left';
    ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(ev.metric.label, padX, centerY);

    // Track bar
    const trackH = isPortrait ? 16 : 12;
    const trackY = centerY - trackH / 2 - 4;
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(barStartX, trackY, barW, trackH);

    // Fill bar
    const pct = ev.percentile ?? 0;
    const fillW = Math.max(ev.percentile !== null ? 4 : 0, (pct / 100) * barW);
    const color = tierColor(ev.percentile);
    ctx.fillStyle = color;
    ctx.fillRect(barStartX, trackY, fillW, trackH);

    // Raw / Per 90 Value
    ctx.textAlign = 'right';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(ev.formattedValue, w - padX - pctColW - 16, centerY);

    // Percentile numeral
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillStyle = color;
    ctx.fillText(ev.percentile !== null ? `${ev.percentile}` : '—', w - padX, centerY);

    // Subtle row hairline
    if (idx < bars.length - 1) {
      ctx.strokeStyle = 'rgba(31, 34, 41, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, y + rowH - 5);
      ctx.lineTo(w - padX, y + rowH - 5);
      ctx.stroke();
    }
  });

  drawFooter(
    ctx,
    w,
    h,
    padX,
    mode,
    minMinutes,
    `THIRD MAN  ·  ${peerCount} ${roleGroup} PEERS`
  );
}

function renderVerdictCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  payload: VerdictCardPayload
) {
  const {
    playerA,
    playerB,
    rows,
    winsA,
    winsB,
    ties,
    mode,
    minMinutes,
    customHeadline,
    showGridTexture = true,
  } = payload;
  const isPortrait = h > w;
  const padX = isPortrait ? 56 : 52;
  const padY = isPortrait ? 48 : 34;

  // Base matte obsidian background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (showGridTexture) {
    drawSubtleGrid(ctx, w, h);
  }

  // Outer editorial frame
  ctx.strokeStyle = COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(16.5, 16.5, w - 33, h - 33);

  drawMasthead(
    ctx,
    w,
    padX,
    padY,
    customHeadline?.trim() || '1V1 VERDICT  ·  HEAD-TO-HEAD COMPARISON'
  );

  // Player A (Left) vs Player B (Right) Header
  const headerTop = padY + 62;
  const centerX = w / 2;
  const sideMaxW = centerX - padX - 88;

  // First names
  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  if (playerA.firstName) ctx.fillText(playerA.firstName, padX, headerTop);
  ctx.textAlign = 'right';
  if (playerB.firstName) ctx.fillText(playerB.firstName, w - padX, headerTop);

  // Surnames
  const surnameY = headerTop + 42;
  fitText(
    ctx,
    playerA.lastName,
    sideMaxW,
    (sz) => `600 ${sz}px "Fraunces", Georgia, serif`,
    isPortrait ? 46 : 44,
    24
  );
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.fillText(playerA.lastName, padX, surnameY);

  fitText(
    ctx,
    playerB.lastName,
    sideMaxW,
    (sz) => `600 ${sz}px "Fraunces", Georgia, serif`,
    isPortrait ? 46 : 44,
    24
  );
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'right';
  ctx.fillText(playerB.lastName, w - padX, surnameY);

  // Center tally readout
  ctx.textAlign = 'center';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('VERDICT', centerX, headerTop + 4);

  ctx.font = '600 28px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.ink;
  const tallyText = `${winsA} — ${winsB}`;
  ctx.fillText(tallyText, centerX, headerTop + 36);

  if (ties > 0) {
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`${ties} EVEN`, centerX, headerTop + 56);
  }

  // Metadata lines
  ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  ctx.fillText(
    `${playerA.squad}  ·  ${playerA.roleGroup}  ·  ${playerA.minutes}'`,
    padX,
    surnameY + 24
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    `${playerB.squad}  ·  ${playerB.roleGroup}  ·  ${playerB.minutes}'`,
    w - padX,
    surnameY + 24
  );

  // Header divider
  const chartTop = surnameY + 46;
  ctx.strokeStyle = COLORS.hairline;
  ctx.beginPath();
  ctx.moveTo(padX, chartTop);
  ctx.lineTo(w - padX, chartTop);
  ctx.stroke();

  // Diverging Horizontal Bars
  const displayRows = rows.slice(0, isPortrait ? 10 : 8);
  const availH = h - chartTop - 92;
  const rowH = Math.min(isPortrait ? 86 : 46, Math.floor((availH - 22) / Math.max(displayRows.length, 1)));
  const centerLabelW = isPortrait ? 190 : 186;
  const valColW = 76;
  const leftTrackEnd = centerX - centerLabelW / 2 - 14;
  const leftTrackStart = padX + valColW + 14;
  const rightTrackStart = centerX + centerLabelW / 2 + 14;
  const rightTrackEnd = w - padX - valColW - 14;
  const maxBarW = Math.max(80, leftTrackEnd - leftTrackStart);

  // Column legend
  const legendY = chartTop + 22;
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'left';
  ctx.fillText(mode === 'per90' ? 'PER 90' : 'TOTAL', padX, legendY);
  ctx.textAlign = 'center';
  ctx.fillText('METRIC  (BARS SCALED BY POSITIONAL PERCENTILE)', centerX, legendY);
  ctx.textAlign = 'right';
  ctx.fillText(mode === 'per90' ? 'PER 90' : 'TOTAL', w - padX, legendY);

  const startY = legendY + 18;
  const barH = isPortrait ? 16 : 12;

  displayRows.forEach((row, idx) => {
    const y = startY + idx * rowH;
    const midY = y + rowH / 2;

    const aWins = row.winner === 'A';
    const bWins = row.winner === 'B';
    const isTie = row.winner === 'tie';

    // Left value (Player A)
    ctx.textAlign = 'left';
    ctx.font = `${aWins ? '600' : '500'} 15px "JetBrains Mono", monospace`;
    ctx.fillStyle = aWins ? COLORS.emerald : isTie ? COLORS.amber : COLORS.ink;
    ctx.fillText(row.formattedA, padX, midY + 5);

    // Right value (Player B)
    ctx.textAlign = 'right';
    ctx.font = `${bWins ? '600' : '500'} 15px "JetBrains Mono", monospace`;
    ctx.fillStyle = bWins ? COLORS.emerald : isTie ? COLORS.amber : COLORS.ink;
    ctx.fillText(row.formattedB, w - padX, midY + 5);

    // Center Metric Label
    ctx.textAlign = 'center';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(row.metric.label, centerX, midY + 4);

    // Left track & diverging fill (grows leftward from leftTrackEnd)
    const trackY = midY - barH / 2 - 1;
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(leftTrackStart, trackY, maxBarW, barH);
    ctx.fillRect(rightTrackStart, trackY, maxBarW, barH);

    // Compute bar ratios (prefer percentile, fallback to relative raw magnitude)
    let ratioA = row.pctA !== null ? row.pctA / 100 : 0;
    let ratioB = row.pctB !== null ? row.pctB / 100 : 0;
    if (row.pctA === null && row.pctB === null && row.valA !== null && row.valB !== null) {
      const m = Math.max(Math.abs(row.valA), Math.abs(row.valB), 0.001);
      ratioA = Math.abs(row.valA) / m;
      ratioB = Math.abs(row.valB) / m;
    }

    const wA = Math.max(ratioA > 0 ? 4 : 0, ratioA * maxBarW);
    const wB = Math.max(ratioB > 0 ? 4 : 0, ratioB * maxBarW);

    ctx.fillStyle = aWins ? COLORS.emerald : isTie ? COLORS.amber : COLORS.barMuted;
    ctx.fillRect(leftTrackEnd - wA, trackY, wA, barH);

    ctx.fillStyle = bWins ? COLORS.emerald : isTie ? COLORS.amber : COLORS.barMuted;
    ctx.fillRect(rightTrackStart, trackY, wB, barH);

    // Subtle row separator
    if (idx < displayRows.length - 1) {
      ctx.strokeStyle = 'rgba(31, 34, 41, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, y + rowH - 2);
      ctx.lineTo(w - padX, y + rowH - 2);
      ctx.stroke();
    }
  });

  drawFooter(
    ctx,
    w,
    h,
    padX,
    mode,
    minMinutes,
    'THIRD MAN  ·  GREEN INDICATES CATEGORY LEADER'
  );
}

export async function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  payload: ExportCardPayload,
  aspect: CardAspectRatio
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const logicalW = aspect === '16:9' ? 1200 : 1080;
  const logicalH = aspect === '16:9' ? 675 : 1350;
  const dpr = 2; // 2x high-DPI crispness for X/Twitter uploads

  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  if (payload.kind === 'dossier') {
    renderDossierCard(ctx, logicalW, logicalH, payload);
  } else {
    renderVerdictCard(ctx, logicalW, logicalH, payload);
  }

  ctx.restore();
}

export function buildVerdictRows(
  playerA: Player,
  playerB: Player,
  metrics: MetricDefinition[],
  pctMapA: Record<string, number | null>,
  pctMapB: Record<string, number | null>,
  mode: StatMode
): { rows: VerdictComparisonRow[]; winsA: number; winsB: number; ties: number } {
  let winsA = 0;
  let winsB = 0;
  let ties = 0;

  const rows: VerdictComparisonRow[] = metrics.map((metric) => {
    const valA = getMetricValue(playerA, metric, mode);
    const valB = getMetricValue(playerB, metric, mode);
    const formattedA = formatMetricValue(valA, metric, mode);
    const formattedB = formatMetricValue(valB, metric, mode);
    const pctA = pctMapA[metric.id] ?? null;
    const pctB = pctMapB[metric.id] ?? null;

    let winner: 'A' | 'B' | 'tie' | 'none' = 'none';
    if (valA !== null && valB !== null) {
      const diff = Math.abs(valA - valB);
      if (diff < 1e-6) {
        winner = 'tie';
        ties++;
      } else if (metric.lowerIsBetter) {
        if (valA < valB) {
          winner = 'A';
          winsA++;
        } else {
          winner = 'B';
          winsB++;
        }
      } else {
        if (valA > valB) {
          winner = 'A';
          winsA++;
        } else {
          winner = 'B';
          winsB++;
        }
      }
    }

    return {
      metric,
      valA,
      valB,
      formattedA,
      formattedB,
      pctA,
      pctB,
      winner,
    };
  });

  return { rows, winsA, winsB, ties };
}
