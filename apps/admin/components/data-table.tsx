'use client';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type RowSelectionState, type SortingState, type OnChangeFn } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> { align?: 'right' }
}

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  caption: string;
  onRowClick?: (row: T) => void;
  activeRow?: (row: T) => boolean;
  getRowId?: (row: T) => string;
  selection?: RowSelectionState;
  onSelectionChange?: OnChangeFn<RowSelectionState>;
  empty?: string;
}

/** Sortable table on TanStack Table. Scrolls sideways on narrow screens. */
export function DataTable<T>({ data, columns, caption, onRowClick, activeRow, getRowId, selection, onSelectionChange, empty = 'Nothing here yet.' }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data, columns, getRowId,
    state: { sorting, rowSelection: selection ?? {} },
    onSortingChange: setSorting,
    onRowSelectionChange: onSelectionChange,
    enableRowSelection: !!onSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                const right = h.column.columnDef.meta?.align === 'right';
                return (
                  <th key={h.id} scope="col" aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={cn('border-b border-line px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted', right ? 'text-right' : 'text-left')}>
                    {h.column.getCanSort() ? (
                      <button onClick={h.column.getToggleSortingHandler()} className="inline-flex cursor-pointer items-center gap-1 font-semibold hover:text-ink">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : null}
                      </button>
                    ) : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(onRowClick && 'cursor-pointer hover:bg-surface-muted', activeRow?.(row.original) && 'bg-tint hover:bg-tint')}>
              {row.getVisibleCells().map((c) => (
                <td key={c.id} className={cn('border-b border-line px-3 py-3 align-middle text-sm whitespace-nowrap', c.column.columnDef.meta?.align === 'right' && 'tnum text-right')}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-ink-muted">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
