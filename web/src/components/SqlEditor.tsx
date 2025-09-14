import React, { useState, useRef } from 'react';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';

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
  const [sql, setSql] = useState('-- Enter your SQL query here\nSELECT name FROM sqlite_master WHERE type=\'table\';');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const editorRef = useRef<AceEditor>(null);

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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-300 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <i className="ti ti-code mr-2"></i>
            SQL Editor
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={executeQuery}
              disabled={isExecuting || !sql.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isExecuting || !sql.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
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
      <div className="flex-1 border-b border-gray-300" style={{ minHeight: '300px' }}>
        <AceEditor
          ref={editorRef}
          mode="sql"
          theme="github"
          value={sql}
          onChange={setSql}
          width="100%"
          height="100%"
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
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {error && (
          <div className="p-4 border-l-4 border-red-400 bg-red-50">
            <div className="flex">
              <div className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        {isExecuting && (
          <div className="p-8 text-center text-gray-600">
            <div className="flex items-center justify-center gap-2">
              <i className="ti ti-loader animate-spin text-xl"></i>
              <span>Executing query...</span>
            </div>
          </div>
        )}

        {results && (
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-4 text-sm text-gray-600 flex items-center justify-between">
              <span>
                {results.rowCount} rows returned in {results.executionTime.toFixed(1)}ms
              </span>
              {results.rows.length > 0 && (
                <button
                  onClick={downloadCsv}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <i className="ti ti-download"></i>
                  Download CSV
                </button>
              )}
            </div>

            {results.rows.length > 0 ? (
              <div className="overflow-auto border border-gray-300 rounded-lg">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {results.columns.map((column, index) => (
                        <th
                          key={index}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-300">
                    {results.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="hover:bg-gray-50"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300 last:border-r-0 font-mono"
                          >
                            {cell === null ? (
                              <span className="text-gray-400 italic">NULL</span>
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
              results && (
                <div className="text-center py-8 text-gray-500">
                  Query executed successfully but returned no results.
                </div>
              )
            )}
          </div>
        )}

        {!results && !isExecuting && !error && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <i className="ti ti-code text-4xl mb-4 text-gray-300"></i>
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