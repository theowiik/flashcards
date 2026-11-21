// Minimal RFC-4180-ish parser with delimiter auto-detection (comma, tab, semicolon).

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const counts = { '\t': 0, ';': 0, ',': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  if (counts['\t'] > 0) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_Q = /^(question|front|term|q|prompt)$/i;
const HEADER_A = /^(answer|back|definition|a|response)$/i;

// Returns { cards: [{q, a}], skipped: number }
export function rowsToCards(rows) {
  if (rows.length && HEADER_Q.test(rows[0][0]?.trim() ?? '') && HEADER_A.test(rows[0][1]?.trim() ?? '')) {
    rows = rows.slice(1);
  }
  const cards = [];
  let skipped = 0;
  for (const r of rows) {
    const q = (r[0] ?? '').trim();
    const a = r.slice(1).join(', ').trim();
    if (q && a) cards.push({ q, a });
    else skipped++;
  }
  return { cards, skipped };
}

function escapeField(s) {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(cards) {
  return ['question,answer', ...cards.map((c) => `${escapeField(c.q)},${escapeField(c.a)}`)].join('\n') + '\n';
}
