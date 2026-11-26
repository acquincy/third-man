import type { Player, RawPlayerRow, RoleGroup } from '../types/player';

const LEAGUE_DISPLAY_MAP: Record<string, string> = {
  'eng Premier League': 'Premier League',
  'es La Liga': 'La Liga',
  'it Serie A': 'Serie A',
  'fr Ligue 1': 'Ligue 1',
  'de Bundesliga': 'Bundesliga',
};

const NUMERIC_COLUMNS = [
  'MP', 'Starts', 'Min', '90s',
  'Gls', 'Ast', 'G+A', 'G-PK', 'PK', 'PKatt', 'CrdY', 'CrdR', 'G+A-PK',
  'xG', 'npxG', 'xAG', 'xA',
  'GA', 'GA90', 'SoTA', 'Saves', 'Save%', 'W', 'D', 'L', 'CS', 'CS%',
  'PKatt_stats_keeper', 'PKA', 'PKsv', 'PKm', 'PSxG', 'PSxG+/-',
  'Sh', 'SoT', 'SoT%', 'Sh/90', 'SoT/90', 'G/Sh', 'G/SoT',
  'Mn/MP', 'Min%', 'Mn/Start', 'Compl', 'Subs', 'Mn/Sub', 'unSub',
  'PPM', 'onG', 'onGA', '+/-', '+/-90', 'On-Off',
  '2CrdY', 'Fls', 'Fld', 'Off', 'Crs', 'Int', 'TklW', 'OG',
  'PrgP', 'PrgC', 'KP', 'SCA', 'GCA', 'Tkl', 'Clr', 'AerWon',
];

/**
 * RFC-4180 compliant single-pass CSV line parser handling quoted commas and escaped quotes.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsvText(csvText: string): { headers: string[]; rows: RawPlayerRow[] } {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows: RawPlayerRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 3) continue;
    const row: RawPlayerRow = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = values[c] ?? '';
    }
    // Skip repeated header rows if present in FBref exports
    if (row.Player === 'Player' || !row.Player) continue;
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Normalizes FBref composite position strings into 5 tactical role groups:
 * - GK: Goalkeepers
 * - FWD: Pure central forwards / strikers ("FW")
 * - WNG/AM: Hybrid wide forwards & attacking midfielders ("FW,MF", "MF,FW", "DF,FW")
 * - MID: Central & box-to-box midfielders ("MF", "MF,DF")
 * - DEF: Center-backs, full-backs & wing-backs ("DF", "DF,MF")
 */
export function normalizeRoleGroup(rawPos: string): RoleGroup {
  const pos = (rawPos || '').toUpperCase().replace(/\s+/g, '');
  if (pos.includes('GK')) return 'GK';
  if (pos === 'FW') return 'FWD';
  if (pos === 'FW,MF' || pos === 'MF,FW' || pos === 'DF,FW' || pos === 'FW,DF') {
    return 'WNG/AM';
  }
  if (pos === 'DF' || pos === 'DF,MF') return 'DEF';
  if (pos === 'MF' || pos === 'MF,DF') return 'MID';
  if (pos.startsWith('FW')) return 'FWD';
  if (pos.startsWith('DF')) return 'DEF';
  return 'MID';
}

export function cleanNation(rawNation: string): { nation: string; code: string } {
  if (!rawNation) return { nation: 'Unknown', code: '—' };
  const parts = rawNation.trim().split(/\s+/);
  const code = (parts[parts.length - 1] || rawNation).toUpperCase();
  return { nation: code, code };
}

export function cleanLeague(rawComp: string): string {
  if (!rawComp) return 'Unknown League';
  if (LEAGUE_DISPLAY_MAP[rawComp]) return LEAGUE_DISPLAY_MAP[rawComp];
  // Strip leading 2-3 lowercase country code like "eng " or "es "
  return rawComp.replace(/^[a-z]{2,3}\s+/, '').trim();
}

export function parseNumericValue(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'nan') return null;
  const cleaned = trimmed.replace(/,/g, '').replace(/%$/, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAge(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Handle both "26.0" and "26-025" formats
  const head = trimmed.split('-')[0];
  const parsed = Number(head);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

export function splitPlayerName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: '', lastName: trimmed };
  }
  // Keep common surname particles together (De, Van, Di, El, Al, Da, Dos, Del, Le, La, Mac, Mc, St)
  const particles = new Set(['de', 'del', 'da', 'do', 'dos', 'das', 'di', 'van', 'von', 'el', 'al', 'le', 'la', 'st', 'san', 'ter']);
  if (parts.length >= 3 && particles.has(parts[parts.length - 2].toLowerCase())) {
    return {
      firstName: parts.slice(0, -2).join(' '),
      lastName: parts.slice(-2).join(' '),
    };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function adaptCsvRowsToPlayers(
  headers: string[],
  rows: RawPlayerRow[]
): { players: Player[]; availableColumns: Set<string> } {
  const availableColumns = new Set<string>(headers);

  // Track which numeric columns actually have non-empty data across the file
  const populatedNumericColumns = new Set<string>();
  const activeNumericCols = NUMERIC_COLUMNS.filter((col) => availableColumns.has(col));

  const players: Player[] = rows.map((row, index) => {
    const rk = parseNumericValue(row.Rk) ?? index + 1;
    const name = (row.Player || '').trim();
    const squad = (row.Squad || 'Unknown Club').trim();
    const rawComp = (row.Comp || '').trim();
    const rawPos = (row.Pos || 'MF').trim();
    const { nation, code } = cleanNation(row.Nation || '');
    const { firstName, lastName } = splitPlayerName(name);

    const minutes = parseNumericValue(row.Min) ?? 0;
    const ninetiesRaw = parseNumericValue(row['90s']);
    const nineties = ninetiesRaw !== null ? ninetiesRaw : Number((minutes / 90).toFixed(1));
    const matchesPlayed = parseNumericValue(row.MP) ?? 0;
    const starts = parseNumericValue(row.Starts) ?? 0;

    const metrics: Record<string, number | null> = {};
    for (const col of activeNumericCols) {
      const val = parseNumericValue(row[col]);
      metrics[col] = val;
      if (val !== null) {
        populatedNumericColumns.add(col);
      }
    }

    return {
      id: `${rk}-${slugify(name)}-${slugify(squad)}`,
      rk,
      name,
      firstName,
      lastName,
      nation,
      nationCode: code,
      rawPos,
      roleGroup: normalizeRoleGroup(rawPos),
      squad,
      league: cleanLeague(rawComp),
      rawComp,
      age: parseAge(row.Age),
      born: parseNumericValue(row.Born),
      matchesPlayed,
      starts,
      minutes,
      nineties,
      metrics,
    };
  });

  // Only keep columns that actually had at least one valid value
  const verifiedColumns = new Set<string>(headers);
  for (const col of activeNumericCols) {
    if (!populatedNumericColumns.has(col)) {
      verifiedColumns.delete(col);
    }
  }

  return { players, availableColumns: verifiedColumns };
}
