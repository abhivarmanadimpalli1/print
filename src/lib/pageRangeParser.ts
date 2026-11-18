/** Parse a strict, one-based page selection against the actual document length. */
export function parsePageRange(value: string, maxPages: number): { valid: boolean; count: number; pages: number[]; error?: string } {
  const invalid = (error: string) => ({ valid: false, count: 0, pages: [], error });
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) return invalid('The document has no printable pages.');
  if (!value.trim()) return { valid: true, count: maxPages, pages: Array.from({ length: maxPages }, (_, i) => i + 1) };
  const pages = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) return invalid(`Invalid page selection: "${part}". Use 1-5, 8.`);
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) return invalid(`Invalid page range: "${part}".`);
    if (end > maxPages) return invalid(`Page ${end} exceeds the document length (${maxPages}).`);
    for (let page = start; page <= end; page++) pages.add(page);
  }
  const ordered = [...pages].sort((a, b) => a - b);
  return { valid: true, count: ordered.length, pages: ordered };
}

export function splitPagesByFile(pageCounts: number[], selected: number[]): number[][] {
  let offset = 0;
  return pageCounts.map(count => {
    const pages = selected.filter(page => page > offset && page <= offset + count).map(page => page - offset);
    offset += count;
    return pages;
  });
}

export function formatPageRanges(pages: number[]): string {
  const ranges: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const start = pages[i];
    while (i + 1 < pages.length && pages[i + 1] === pages[i] + 1) i++;
    ranges.push(start === pages[i] ? String(start) : `${start}-${pages[i]}`);
  }
  return ranges.join(', ');
}
