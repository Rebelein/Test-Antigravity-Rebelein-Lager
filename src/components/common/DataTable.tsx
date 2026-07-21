import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  accessor: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  externalSearchQuery?: string;
  hideSearch?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
  headerActions?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchPlaceholder = 'Suchen...',
  searchFilter,
  externalSearchQuery,
  hideSearch = false,
  emptyMessage = 'Keine Einträge gefunden.',
  actions,
  headerActions,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const activeSearchQuery = externalSearchQuery !== undefined ? externalSearchQuery : searchQuery;

  // Filtered Data
  const filteredData = useMemo(() => {
    if (!activeSearchQuery.trim() || !searchFilter) return data;
    const query = activeSearchQuery.toLowerCase();
    return data.filter(item => searchFilter(item, query));
  }, [data, activeSearchQuery, searchFilter]);

  // Sorted Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const column = columns.find(c => c.key === sortKey);
    if (!column || !column.sortable) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = column.sortValue ? column.sortValue(a) : (a as any)[sortKey];
      const valB = column.sortValue ? column.sortValue(b) : (b as any)[sortKey];

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortOrder, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
      {/* Top Search & Filter Bar */}
      {(!hideSearch || headerActions) && (
        <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/30">
          {!hideSearch && (
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
              />
            </div>
          )}

          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* High Density Table Body */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-md border-b border-border z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{ width: col.width }}
                  className={clsx(
                    "px-4 py-3.5 font-bold text-muted-foreground uppercase text-[11px] tracking-wider select-none",
                    col.sortable && "cursor-pointer hover:text-foreground transition-colors",
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  <div className={clsx(
                    "flex items-center gap-1.5",
                    col.align === 'center' && 'justify-center',
                    col.align === 'right' && 'justify-end'
                  )}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-muted-foreground">
                        {sortKey === col.key ? (
                          sortOrder === 'asc' ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-primary" />
                        ) : (
                          <ChevronsUpDown size={14} className="opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="px-4 py-3.5 font-bold text-muted-foreground uppercase text-[11px] tracking-wider text-right">Aktionen</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => {
                const key = keyExtractor(item);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={clsx(
                      "transition-colors hover:bg-muted/40",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={clsx(
                          "px-4 py-3 text-foreground font-medium align-middle",
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                      >
                        {col.accessor(item)}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
        <span>{sortedData.length} Einträge insgesamt</span>
        {searchQuery && <span>Filter aktiv: "{searchQuery}"</span>}
      </div>
    </div>
  );
}
