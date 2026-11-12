"use client";

import * as React from "react";
import {
  tableFeatures,
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  useTable,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnVisibilityState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Module-scoped features instance
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// Convenient column definition type for consumers
export type DataTableColumnDef<
  TData extends Record<string, unknown>,
  TValue = unknown
> = ColumnDef<DataTableFeatures, TData, TValue>;

export interface DataTableProps<TData extends Record<string, unknown>> {
  columns: DataTableColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  extraActions?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonRowCount?: number;
}

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = "Search records...",
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  extraActions,
  onRowClick,
  className,
  emptyTitle = "No records found",
  emptyDescription = "There are no records matching your query or filters.",
  skeletonRowCount = 5,
}: DataTableProps<TData>) {
  // Controlled state slices
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [searchValue, setSearchValue] = React.useState<string>("");
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  // Debounce search input for 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setGlobalFilter(searchValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchValue]);

  // Fallback stable data reference
  const stableData = React.useMemo(() => data ?? [], [data]);

  // Construct TanStack Table v9 instance
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: stableData,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const visibleColumns = table.getAllLeafColumns().filter((c) => c.getIsVisible());
  const rowCount = table.getRowModel().rows.length;
  const totalRecords = stableData.length;

  const startRecord =
    rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const endRecord = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    totalRecords
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar with 300ms debounce */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8 h-8 text-xs bg-background"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setGlobalFilter("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls: Extra Actions & Column Visibility */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {extraActions}

          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  <span>Columns</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-60 overflow-y-auto">
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    const headerValue = column.columnDef.header;
                    const label =
                      typeof headerValue === "string" ? headerValue : column.id;
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="text-xs capitalize"
                        checked={column.getIsVisible()}
                        closeOnClick={false}
                        onCheckedChange={(checked) =>
                          column.toggleVisibility(Boolean(checked))
                        }
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Data Table Container */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 text-xs font-semibold text-muted-foreground",
                        canSort && "cursor-pointer select-none hover:text-foreground"
                      )}
                      onClick={canSort ? () => header.column.toggleSorting() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1.5">
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          {canSort && (
                            <span className="shrink-0">
                              {isSorted === "asc" ? (
                                <ArrowUp className="size-3.5 text-primary" />
                              ) : isSorted === "desc" ? (
                                <ArrowDown className="size-3.5 text-primary" />
                              ) : (
                                <ArrowUpDown className="size-3 text-muted-foreground/50 opacity-60 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: skeletonRowCount }).map((_, rIndex) => (
                <TableRow key={`skeleton-row-${rIndex}`} className="hover:bg-transparent">
                  {visibleColumns.map((col, cIndex) => (
                    <TableCell key={`skeleton-cell-${col.id}-${cIndex}`} className="py-3 px-3">
                      <Skeleton className="h-4 w-full max-w-[85%] rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rowCount > 0 ? (
              // Real Table Data Rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    "text-xs border-b border-border/50 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // Empty State Illustration Fallback
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumns.length || 1}
                  className="h-48 text-center py-8"
                >
                  <div className="flex flex-col items-center justify-center space-y-2 text-center max-w-sm mx-auto">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground/70">
                      <Inbox className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {emptyTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emptyDescription}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground px-1">
        {/* Record Range Counter */}
        <div className="text-xs">
          Showing <span className="font-medium text-foreground">{startRecord}</span> to{" "}
          <span className="font-medium text-foreground">{endRecord}</span> of{" "}
          <span className="font-medium text-foreground">{totalRecords}</span> records
        </div>

        {/* Pagination Action Controls */}
        <div className="flex items-center gap-4">
          {/* Rows Per Page Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs whitespace-nowrap">Rows per page</span>
            <select
              value={table.state.pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {pageSizeOptions.map((size) => (
                <option
                  key={size}
                  value={size}
                  className="bg-popover text-popover-foreground"
                >
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Current Page Indicator */}
          <span className="text-xs font-medium whitespace-nowrap text-foreground">
            Page {table.state.pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </span>

          {/* First / Prev / Next / Last Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage() || isLoading}
              title="First Page"
              aria-label="First Page"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage() || isLoading}
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage() || isLoading}
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage() || isLoading}
              title="Last Page"
              aria-label="Last Page"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
