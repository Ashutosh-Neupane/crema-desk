"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappePost } from "@/lib/frappe/client";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { AlertCircle, Play, Trash2, Clock } from "lucide-react";

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  message?: string;
}

interface HistoryEntry {
  query: string;
  timestamp: number;
  error?: string;
}

export function SystemConsole() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const { data: result, isLoading, error } = useQuery<QueryResult>({
    queryKey: ["sql-query", query],
    queryFn: async () => {
      const res = await frappePost<{ message: QueryResult }>("api/method/crema.system_console.execute", {
        query,
      });
      return res.message ?? { columns: [], rows: [] };
    },
    enabled: false,
    retry: false,
  });

  const executeMutation = useMutation({
    mutationFn: async (sql: string) => {
      const res = await frappePost<{ message: QueryResult }>("api/method/crema.system_console.execute", {
        query: sql,
      });
      return res.message ?? { columns: [], rows: [] };
    },
    onSuccess: (data, sql) => {
      setHistory((h) => [{ query: sql, timestamp: Date.now() }, ...h.slice(0, 49)]);
      queryClient.setQueryData(["sql-query", sql], data);
    },
  });

  const handleExecute = useCallback(() => {
    if (!query.trim()) return;
    executeMutation.mutate(query);
  }, [query, executeMutation]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setQuery(entry.query);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">System Console</h2>
        <p className="text-sm text-zinc-500">Execute SQL queries against the database (read-only recommended)</p>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          <textarea aria-label="Script"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter SQL query..."
            className="w-full h-32 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
            spellCheck={false}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleExecute} disabled={isLoading || !query.trim()}>
              <Play className="h-4 w-4 mr-1" />
              {isLoading ? "Running..." : "Run Query"}
            </Button>
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {(result || error) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Results</h3>
            {result && (
              <Badge variant="secondary">{result.rows.length} rows</Badge>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4" />
              {(error as Error).message || "Query failed"}
            </div>
          )}

          {result && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    {result.columns.map((col) => (
                      <th key={col} className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 px-3 text-zinc-900 dark:text-zinc-100">
                          {cell === null ? <span className="text-zinc-400">NULL</span> : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && result.rows.length === 0 && !error && (
            <p className="text-sm text-zinc-500 text-center py-4">Query returned 0 rows</p>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </h3>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => loadFromHistory(entry)}
                className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <code className="text-xs text-zinc-700 dark:text-zinc-300">{entry.query}</code>
                {entry.error && <p className="text-xs text-red-600 mt-1">{entry.error}</p>}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
