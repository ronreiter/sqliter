import React, { useState, useRef, useMemo } from 'react';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-cloud_editor_dark';
import 'ace-builds/src-noconflict/ext-language_tools';

import { useTheme } from '../contexts/ThemeContext';

interface SqlEditorProps {
  onRefresh?: () => void;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ onRefresh }) => {
  const { isDark } = useTheme();
  const [sql, setSql] = useState('-- Enter your SQL query here\nSELECT name FROM sqlite_master WHERE type=\'table\';');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [wrapTextMode, setWrapTextMode] = useState(false);
  const editorRef = useRef<AceEditor>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pagination logic
  const paginatedData = useMemo(() => {
    if (!results || !results.rows) return { data: [], totalPages: 0, startIndex: 0, endIndex: 0 };

    const totalPages = Math.ceil(results.rows.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, results.rows.length);
    const data = results.rows.slice(startIndex, endIndex);

    return { data, totalPages, startIndex, endIndex };
  }, [results, currentPage, pageSize]);

  const executeQuery = async () => {
    if (!sql.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      const startTime = performance.now();
      const response = await fetch('/api/sql/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: sql.trim() }),
      });

      const endTime = performance.now();
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      setResults({
        columns: data.columns || [],
        rows: data.rows || [],
        rowCount: data.rowCount || 0,
        executionTime: endTime - startTime,
      });

      // Reset pagination to first page
      setCurrentPage(1);

      // If tables might have been modified, refresh the table list
      if (onRefresh && /\b(CREATE|DROP|ALTER|INSERT|UPDATE|DELETE)\b/i.test(sql)) {
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const downloadCsv = () => {
    if (!results || results.rows.length === 0) return;

    const csvContent = [
      results.columns.join(','),
      ...results.rows.map(row =>
        row.map(cell => {
          const cellStr = String(cell || '');
          // Escape quotes and wrap in quotes if contains comma/quote/newline
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  };

  // Focus the appropriate editor when switching modes
  const handleModeToggle = () => {
    setWrapTextMode(!wrapTextMode);
    // Focus will happen after the component re-renders
    setTimeout(() => {
      if (!wrapTextMode) {
        // Switching to textarea mode
        textareaRef.current?.focus();
      } else {
        // Switching to ace editor mode
        editorRef.current?.editor?.focus();
      }
    }, 0);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <i className="ti ti-code mr-2"></i>
            SQL Editor
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleModeToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                wrapTextMode
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={wrapTextMode ? 'Switch to code editor' : 'Switch to wrap text mode'}
            >
              <i className={wrapTextMode ? 'ti ti-code-off' : 'ti ti-text-wrap'}></i>
              {wrapTextMode ? 'Code Editor' : 'Wrap Text'}
            </button>
            <button
              onClick={executeQuery}
              disabled={isExecuting || !sql.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isExecuting || !sql.trim()
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white'
              }`}
            >
              {isExecuting ? (
                <>
                  <i className="ti ti-loader animate-spin"></i>
                  Executing...
                </>
              ) : (
                <>
                  <i className="ti ti-player-play"></i>
                  Run Query
                  <span className="text-xs opacity-75 ml-1">(Ctrl+Enter)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="h-80 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
        {wrapTextMode ? (
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                executeQuery();
              }
            }}
            className="w-full h-full p-4 font-mono text-sm resize-none border-none outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="-- Enter your SQL query here
SELECT name FROM sqlite_master WHERE type='table';"
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              lineHeight: '1.5'
            }}
          />
        ) : (
          <AceEditor
            ref={editorRef}
            mode="sql"
            theme={isDark ? "cloud_editor_dark" : "github"}
            value={sql}
            onChange={setSql}
            width="100%"
            height="320px"
            fontSize={14}
            showGutter={true}
            showPrintMargin={false}
            highlightActiveLine={true}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showLineNumbers: true,
              tabSize: 2,
            }}
            commands={[
              {
                name: 'executeQuery',
                bindKey: { win: 'Ctrl-Enter', mac: 'Cmd-Enter' },
                exec: executeQuery,
              },
            ]}
            onLoad={(editor) => {
              editor.getSession().setUseWrapMode(true);
              editor.focus();
            }}
          />
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-gray-900 min-h-0">
        {error && (
          <div className="p-4 border-l-4 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20">
            <div className="flex">
              <div className="text-sm text-red-700 dark:text-red-400">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        {isExecuting && (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <i className="ti ti-loader animate-spin text-xl"></i>
              <span>Executing query...</span>
            </div>
          </div>
        )}

        {results && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Results Header */}
            <div className="p-4 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {results.rowCount} rows returned in {results.executionTime.toFixed(1)}ms
                  </span>
                  {results.rows.length > 0 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {paginatedData.startIndex + 1}-{paginatedData.endIndex} of {results.rows.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {results.rows.length > 0 && (
                    <>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                        <option value={200}>200 per page</option>
                      </select>
                      <button
                        onClick={downloadCsv}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        <i className="ti ti-download"></i>
                        Download CSV
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Pagination Controls */}
              {results.rows.length > 0 && paginatedData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <i className="ti ti-chevrons-left"></i>
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <i className="ti ti-chevron-left"></i>
                  </button>
                  <span className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {paginatedData.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === paginatedData.totalPages}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <i className="ti ti-chevron-right"></i>
                  </button>
                  <button
                    onClick={() => setCurrentPage(paginatedData.totalPages)}
                    disabled={currentPage === paginatedData.totalPages}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <i className="ti ti-chevrons-right"></i>
                  </button>
                </div>
              )}
            </div>

            {/* Results Table */}
            {results.rows.length > 0 ? (
              <div className="flex-1 overflow-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      {results.columns.map((column, index) => (
                        <th
                          key={index}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-300 dark:border-gray-600 last:border-r-0"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedData.data.map((row, rowIndex) => (
                      <tr
                        key={paginatedData.startIndex + rowIndex}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 last:border-r-0 font-mono max-w-xs truncate"
                            title={cell === null ? 'NULL' : String(cell)}
                          >
                            {cell === null ? (
                              <span className="text-gray-400 dark:text-gray-500 italic">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <i className="ti ti-check-circle text-4xl mb-4 text-green-400"></i>
                  <div className="text-lg mb-2">Query executed successfully</div>
                  <div className="text-sm">No results returned</div>
                </div>
              </div>
            )}
          </div>
        )}

        {!results && !isExecuting && !error && (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <i className="ti ti-code text-4xl mb-4 text-gray-300 dark:text-gray-600"></i>
              <div className="text-lg mb-2">Ready to execute SQL queries</div>
              <div className="text-sm">
                Write your SQL query above and click "Run Query" or press Ctrl+Enter
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};