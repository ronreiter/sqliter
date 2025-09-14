import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { TableList } from './components/TableList';
import { TableView } from './components/TableView';
import { SqlEditor } from './components/SqlEditor';
import { api } from './api';
import { Table, DatabaseInfo } from './types';

// Layout component that wraps all pages
function Layout({ children, tables, databaseInfo, pendingChangesByTable }: {
  children: React.ReactNode;
  tables: Table[];
  databaseInfo: DatabaseInfo | null;
  pendingChangesByTable: Record<string, number>;
}) {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <i className="ti ti-database"></i>
          SQLiter{databaseInfo && ` - ${databaseInfo.filename}`}
        </h1>
        <p className="text-blue-100 text-sm">SQLite Database Editor</p>
      </header>

      <div className="flex-1 flex">
        <TableList
          tables={tables}
          pendingChangesByTable={pendingChangesByTable}
        />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// Home page component
function HomePage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-gray-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
        </svg>
        <p className="text-lg">Select a table to view its contents or use the SQL Editor</p>
      </div>
    </div>
  );
}

// Table page component
function TablePage() {
  const { tableName } = useParams<{ tableName: string }>();
  const navigate = useNavigate();
  const [pendingChanges, setPendingChanges] = useState(0);

  const loadTables = async () => {
    // This would be called when tables are refreshed
    window.location.reload();
  };

  const handlePendingChangesUpdate = (table: string, count: number) => {
    setPendingChanges(count);
  };

  if (!tableName) {
    return <HomePage />;
  }

  return (
    <TableView
      tableName={tableName}
      onRefresh={loadTables}
      onPendingChangesUpdate={handlePendingChangesUpdate}
    />
  );
}

// SQL Editor page component
function SqlEditorPage() {
  const loadTables = async () => {
    // Refresh tables after SQL operations that might change schema
    window.location.reload();
  };

  return <SqlEditor onRefresh={loadTables} />;
}

function App() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [pendingChangesByTable, setPendingChangesByTable] = useState<Record<string, number>>({});

  const loadTables = async () => {
    try {
      setLoading(true);
      const [fetchedTables, dbInfo] = await Promise.all([
        api.getTables(),
        api.getDatabaseInfo()
      ]);
      setTables(fetchedTables);
      setDatabaseInfo(dbInfo);
      setError(null);
    } catch (err) {
      setError('Failed to load tables');
      console.error('Error loading tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handlePendingChangesUpdate = (tableName: string, count: number) => {
    setPendingChangesByTable(prev => ({
      ...prev,
      [tableName]: count
    }));
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading SQLiter...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={loadTables}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <Layout tables={tables} databaseInfo={databaseInfo} pendingChangesByTable={pendingChangesByTable}>
          <HomePage />
        </Layout>
      } />
      <Route path="/table/:tableName" element={
        <Layout tables={tables} databaseInfo={databaseInfo} pendingChangesByTable={pendingChangesByTable}>
          <TablePage />
        </Layout>
      } />
      <Route path="/sql" element={
        <Layout tables={tables} databaseInfo={databaseInfo} pendingChangesByTable={pendingChangesByTable}>
          <SqlEditorPage />
        </Layout>
      } />
    </Routes>
  );
}

export default App;