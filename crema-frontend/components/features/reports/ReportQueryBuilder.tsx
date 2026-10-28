"use client";

import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Play, RefreshCw, Plus, Trash2, BarChart3 } from "lucide-react";
import { useReportsList, useReportMeta, useReport } from "@/lib/hooks/useReport";

interface ReportFilter {
  id: string;
  fieldname: string;
  operator: string;
  value: string;
  value2?: string;
}

interface ReportColumn {
  fieldname: string;
  label: string;
}

interface ReportMeta {
  name: string;
  report_name?: string;
  fields?: Array<{
    fieldname: string;
    label: string;
    fieldtype: string;
    options?: string;
  }>;
}

const FILTER_OPERATORS = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not Equals" },
  { value: ">", label: "Greater Than" },
  { value: "<", label: "Less Than" },
  { value: ">=", label: "Greater or Equal" },
  { value: "<=", label: "Less or Equal" },
  { value: "like", label: "Contains" },
  { value: "not like", label: "Not Contains" },
  { value: "in", label: "In" },
  { value: "not in", label: "Not In" },
  { value: "Between", label: "Between" },
];

export function ReportQueryBuilder() {
  const [selectedReport, setSelectedReport] = useState("");
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const buildFilters = useCallback(() => {
    if (filters.length === 0) return undefined;
    const result: Record<string, unknown> = {};
    for (const filter of filters) {
      if (filter.operator === "Between") {
        result[filter.fieldname] = [filter.value, filter.value2];
      } else {
        result[filter.fieldname] = filter.value;
      }
    }
    return result;
  }, [filters]);

  const { data: reports } = useReportsList();
  const { data: reportMeta } = useReportMeta(selectedReport);
  const { data: reportData, isLoading: reportLoading, refetch, error } = useReport(selectedReport, buildFilters());

  const reportList = useMemo(() => {
    if (!reports) return [];
    return reports
      .filter((r: { name: string; report_name?: string }) => r.name && !r.name.startsWith("__"))
      .map((r: { name: string; report_name?: string }) => ({
        value: r.report_name || r.name,
        label: r.report_name || r.name,
      }));
  }, [reports]);

  const availableFields = useMemo(() => {
    return (reportMeta as ReportMeta | undefined)?.fields ?? [];
  }, [reportMeta]);

  const availableColumns = useMemo(() => {
    if (!reportData?.columns) return [];
    const raw = reportData.columns as Array<string | { fieldname?: string; label?: string }>;
    if (raw.length === 0) return [];
    if (typeof raw[0] === "string") {
      return raw.map((col) => ({ fieldname: col as string, label: col as string }));
    }
    return raw.map((col) => ({
      fieldname: (col as { fieldname?: string }).fieldname ?? String(col),
      label: (col as { label?: string }).label ?? String(col),
    }));
  }, [reportData]);

  const rows = useMemo(() => {
    if (!reportData?.result || !Array.isArray(reportData.result)) return [];
    return reportData.result as Array<Record<string, unknown>>;
  }, [reportData]);

  const addFilter = () => {
    setFilters([
      ...filters,
      {
        id: `filter-${Date.now()}`,
        fieldname: availableFields[0]?.fieldname || "",
        operator: "=",
        value: "",
      },
    ]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const toggleColumn = (fieldname: string) => {
    setSelectedColumns((prev) =>
      prev.includes(fieldname)
        ? prev.filter((c) => c !== fieldname)
        : [...prev, fieldname]
    );
  };

  const handleRunReport = async () => {
    if (!selectedReport) return;
    setIsRunning(true);
    try {
      await refetch();
    } finally {
      setIsRunning(false);
    }
  };

  const getColumnValue = (row: Record<string, unknown>, col: ReportColumn) => {
    const key = col.fieldname;
    return row[key] !== undefined ? String(row[key]) : "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Reports</h1>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>Report</Label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {reportList.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleRunReport}
            disabled={!selectedReport || reportLoading || isRunning}
          >
            {reportLoading || isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
        </div>

        {selectedReport && (
          <div className="mt-4 space-y-4">
            {/* Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Filters</Label>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter
                </Button>
              </div>
              {filters.length === 0 ? (
                <p className="text-sm text-zinc-500">No filters applied.</p>
              ) : (
                <div className="space-y-2">
                  {filters.map((filter) => (
                    <div key={filter.id} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={filter.fieldname}
                        onValueChange={(value) => updateFilter(filter.id, { fieldname: value })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((field) => (
                            <SelectItem key={field.fieldname} value={field.fieldname}>
                              {field.label || field.fieldname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {filter.operator === "Between" ? (
                        <>
                          <Input
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="From"
                            className="w-[120px]"
                          />
                          <Input
                            value={filter.value2 || ""}
                            onChange={(e) => updateFilter(filter.id, { value2: e.target.value })}
                            placeholder="To"
                            className="w-[120px]"
                          />
                        </>
                      ) : (
                        <Input
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          placeholder="Value"
                          className="w-[140px]"
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Columns */}
            {availableColumns.length > 0 && (
              <div>
                <Label className="mb-2 block">Columns</Label>
                <div className="flex flex-wrap gap-2">
                  {availableColumns.map((col) => (
                    <button
                      key={col.fieldname}
                      onClick={() => toggleColumn(col.fieldname)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        selectedColumns.includes(col.fieldname)
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {col.label || col.fieldname}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {error && (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to run report"}
        </div>
      )}

      {reportData && (
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {selectedReport}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  {(selectedColumns.length > 0
                    ? availableColumns.filter((c) => selectedColumns.includes(c.fieldname))
                    : availableColumns
                  ).map((col) => (
                    <th
                      key={col.fieldname}
                      className="px-4 py-2 text-left text-xs font-medium text-zinc-500"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedColumns.length > 0 ? selectedColumns.length : availableColumns.length}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      No results found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={String(row.__name || idx)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      {(selectedColumns.length > 0
                        ? availableColumns.filter((c) => selectedColumns.includes(c.fieldname))
                        : availableColumns
                      ).map((col) => (
                        <td key={col.fieldname} className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                          {getColumnValue(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {reportData.chart && (
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <BarChart3 className="h-4 w-4" />
                Chart data available (render with recharts)
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
