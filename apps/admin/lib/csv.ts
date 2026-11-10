/** Builds a CSV in the browser and downloads it. */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = Object.keys(rows[0]!);
  const csv = [head.map(cell).join(','), ...rows.map((r) => head.map((h) => cell(r[h] ?? '')).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
