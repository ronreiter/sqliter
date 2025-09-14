import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Table } from '../types';

interface TableListProps {
  tables: Table[];
  pendingChangesByTable: Record<string, number>;
}

export const TableList: React.FC<TableListProps> = ({ tables, pendingChangesByTable }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-300 h-full overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-gray-300 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">Tables</h2>
      </div>

      {/* SQL Editor Button */}
      <div className="p-2 border-b border-gray-300">
        <Link
          to="/sql"
          className={`w-full text-left p-3 rounded-md mb-1 transition-colors flex items-center block ${
            currentPath === '/sql'
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'hover:bg-gray-200 text-gray-700'
          }`}
        >
          <i className="ti ti-code mr-2"></i>
          <span className="font-medium">SQL Editor</span>
        </Link>
      </div>

      <div className="p-2">
        {tables.map((table) => (
          <Link
            key={table.name}
            to={`/table/${table.name}`}
            className={`w-full text-left p-3 rounded-md mb-1 transition-colors block ${
              currentPath === `/table/${table.name}`
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <i className="ti ti-table mr-2"></i>
                <span className="font-mono text-sm">{table.name}</span>
              </div>
              {(pendingChangesByTable[table.name] || 0) > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-1 ml-2">
                  {pendingChangesByTable[table.name]}
                </span>
              )}
            </div>
          </Link>
        ))}
        {tables.length === 0 && (
          <p className="text-gray-500 text-sm p-3">No tables found</p>
        )}
      </div>
    </div>
  );
};