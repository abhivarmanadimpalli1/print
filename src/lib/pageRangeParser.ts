/**
 * Parses user input like "1-4, 7, 9-11" and computes the total count of valid pages within 1..maxPages
 */
export function parsePageRange(rangeStr: string, maxPages: number): { valid: boolean; count: number; error?: string } {
  if (!rangeStr.trim()) {
    return { valid: true, count: maxPages };
  }

  const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
  const selectedPages = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return { valid: false, count: 0, error: `Invalid range format: "${part}". Example: 1-5, 8` };
      }

      if (end > maxPages) {
        return { valid: false, count: 0, error: `Page ${end} exceeds total document pages (${maxPages})` };
      }

      for (let p = start; p <= end; p++) {
        selectedPages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (isNaN(p) || p < 1) {
        return { valid: false, count: 0, error: `Invalid page number: "${part}"` };
      }
      if (p > maxPages) {
        return { valid: false, count: 0, error: `Page ${p} exceeds total document pages (${maxPages})` };
      }
      selectedPages.add(p);
    }
  }

  if (selectedPages.size === 0) {
    return { valid: false, count: 0, error: 'No valid pages selected' };
  }

  return { valid: true, count: selectedPages.size };
}
