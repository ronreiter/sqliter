import React, { useState, useEffect } from 'react';
import { TableData, Column } from '../types';
import { api } from '../api';

interface TableViewProps {
  tableName: string;
  onRefresh?: () => void;
  onPendingChangesUpdate?: (tableName: string, count: number) => void;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  columns: Column[];
  initialData?: Record<string, any>;
  title: string;
}

interface PendingChange {
  rowIndex: number;
  columnName: string;
  originalValue: any;
  newValue: any;
}

interface EditingCell {
  rowIndex: number;
  columnName: string;
}

interface NewRowData {
  [columnName: string]: any;
}

interface ErrorDialog {
  isOpen: boolean;
  title: string;
  message: string;
}

interface ConfirmDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const getInputType = (columnType: string): string => {
  const type = columnType.toLowerCase();
  if (type.includes('bool') || type.includes('boolean')) {
    return 'checkbox';
  }
  if (type.includes('int') || type.includes('real') || type.includes('numeric') || type.includes('decimal')) {
    return 'number';
  }
  if (type.includes('datetime') || type.includes('timestamp')) {
    return 'datetime-local';
  }
  if (type.includes('date')) {
    return 'date';
  }
  if (type.includes('time')) {
    return 'time';
  }
  if (type.includes('email')) {
    return 'email';
  }
  if (type.includes('url')) {
    return 'url';
  }
  return 'text';
};

const isBooleanColumn = (columnType: string): boolean => {
  const type = columnType.toLowerCase();
  return type.includes('bool') || type.includes('boolean');
};

const getBooleanValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1';
};

interface ErrorDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

const ErrorDialogComponent: React.FC<ErrorDialogProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <i className="ti ti-alert-circle text-red-500 text-2xl"></i>
          <h3 className="text-lg font-semibold text-red-600">{title}</h3>
        </div>
        <p className="text-gray-700 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialogComponent: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-500 hover:bg-red-600",
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-lg p-6 w-96 max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <i className="ti ti-alert-triangle text-orange-500 text-2xl"></i>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <p className="text-gray-700 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, columns, initialData, title }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      const emptyData: Record<string, any> = {};
      columns.forEach(col => {
        emptyData[col.name] = '';
      });
      setFormData(emptyData);
    }
  }, [initialData, columns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <form onSubmit={handleSubmit}>
          {columns.map((column) => (
            <div key={column.name} className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {column.name}
                {column.not_null && <span className="text-red-500">*</span>}
                <span className="text-xs text-gray-500 ml-1">({column.type})</span>
              </label>
              <input
                type={getInputType(column.type)}
                value={formData[column.name] || ''}
                onChange={(e) => setFormData({ ...formData, [column.name]: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                required={column.not_null}
                disabled={column.primary_key && !!initialData}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TableView: React.FC<TableViewProps> = ({ tableName, onRefresh, onPendingChangesUpdate }) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    mode: 'insert' | 'update';
    data?: Record<string, any>;
  }>({ isOpen: false, mode: 'insert' });

  // New state for inline editing and unsaved changes
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [newRowData, setNewRowData] = useState<NewRowData>({});

  // Row selection and pagination state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<ErrorDialog>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Helper function to show error dialog
  const showError = (title: string, message: string) => {
    setErrorDialog({
      isOpen: true,
      title,
      message
    });
  };

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Helper function to show confirm dialog
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  // Notify parent component about pending changes count
  useEffect(() => {
    // Count unique rows with changes, not individual cell changes
    const uniqueRows = new Set(Object.values(pendingChanges).map(change => change.rowIndex));
    const count = uniqueRows.size;
    onPendingChangesUpdate?.(tableName, count);
  }, [pendingChanges, tableName, onPendingChangesUpdate]);

  // Clean up pending changes count when component unmounts or table changes
  useEffect(() => {
    return () => {
      onPendingChangesUpdate?.(tableName, 0);
    };
  }, [tableName, onPendingChangesUpdate]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const data = await api.getTableData(tableName, pageSize, offset);
      setTableData(data);
      setError(null);
      // Clear selections when loading new data
      setSelectedRows(new Set());
    } catch (err) {
      setError('Failed to load table data');
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTableData();
  }, [tableName, currentPage, pageSize]);

  const handleInsert = async (data: Record<string, any>) => {
    try {
      await api.insertRow(tableName, data);
      setEditModal({ isOpen: false, mode: 'insert' });
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error inserting row:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Insert Row', errorMessage);
    }
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (!editModal.data) return;

    try {
      const primaryKeyColumns = tableData?.columns.filter(col => col.primary_key) || [];
      const whereClause: Record<string, any> = {};

      primaryKeyColumns.forEach(col => {
        whereClause[col.name] = editModal.data![col.name];
      });

      const updateData: Record<string, any> = {};
      Object.keys(data).forEach(key => {
        if (!primaryKeyColumns.some(col => col.name === key)) {
          updateData[key] = data[key];
        }
      });

      await api.updateRow(tableName, updateData, whereClause);
      setEditModal({ isOpen: false, mode: 'insert' });
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error updating row:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Update Row', errorMessage);
    }
  };

  const handleDelete = (row: Record<string, any>) => {
    showConfirm(
      'Delete Row',
      'Are you sure you want to delete this row? This action cannot be undone.',
      () => handleDeleteConfirmed(row)
    );
  };

  const handleDeleteConfirmed = async (row: Record<string, any>) => {
    try {
      const primaryKeyColumns = tableData?.columns.filter(col => col.primary_key) || [];
      const whereClause: Record<string, any> = {};

      primaryKeyColumns.forEach(col => {
        whereClause[col.name] = row[col.name];
      });

      await api.deleteRow(tableName, whereClause);
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error deleting row:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Delete Row', errorMessage);
    }
  };

  // New handler functions for inline editing
  const handleCellDoubleClick = (rowIndex: number, columnName: string, currentValue: any) => {
    setEditingCell({ rowIndex, columnName });
  };

  const handleCellEdit = (rowIndex: number, columnName: string, newValue: any, originalValue: any) => {
    const changeKey = `${rowIndex}-${columnName}`;
    if (newValue !== originalValue) {
      setPendingChanges(prev => ({
        ...prev,
        [changeKey]: { rowIndex, columnName, originalValue, newValue }
      }));
    } else {
      setPendingChanges(prev => {
        const { [changeKey]: removed, ...rest } = prev;
        return rest;
      });
    }
    setEditingCell(null);
  };

  const handleSetNull = (rowIndex: number, columnName: string) => {
    if (!tableData) return;
    const originalValue = tableData.rows[rowIndex][columnName];
    const changeKey = `${rowIndex}-${columnName}`;

    setPendingChanges(prev => ({
      ...prev,
      [changeKey]: { rowIndex, columnName, originalValue, newValue: null }
    }));
  };

  const handleNewRowChange = (columnName: string, value: any) => {
    setNewRowData(prev => ({
      ...prev,
      [columnName]: value
    }));
  };

  const handleSaveChanges = async (rowIndex: number) => {
    if (!tableData) return;

    try {
      const rowChanges = Object.values(pendingChanges).filter(change => change.rowIndex === rowIndex);
      const row = tableData.rows[rowIndex];
      const primaryKeyColumns = tableData.columns.filter(col => col.primary_key);
      const whereClause: Record<string, any> = {};

      primaryKeyColumns.forEach(col => {
        whereClause[col.name] = row[col.name];
      });

      const updateData: Record<string, any> = {};
      rowChanges.forEach(change => {
        updateData[change.columnName] = change.newValue;
      });

      await api.updateRow(tableName, updateData, whereClause);

      // Remove only the changes for this row (this will hide the save button for this row)
      setPendingChanges(prev => {
        const updated = { ...prev };
        rowChanges.forEach(change => {
          const key = `${change.rowIndex}-${change.columnName}`;
          delete updated[key];
        });
        return updated;
      });

      // Update the table data in place without refreshing the whole table
      // This keeps any editing states active while reflecting the saved changes
      setTableData(prev => {
        if (!prev) return prev;
        const updatedRows = [...prev.rows];
        Object.keys(updateData).forEach(columnName => {
          updatedRows[rowIndex] = {
            ...updatedRows[rowIndex],
            [columnName]: updateData[columnName]
          };
        });
        return {
          ...prev,
          rows: updatedRows
        };
      });

      onRefresh?.();
    } catch (err: any) {
      console.error('Error saving changes:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Save Changes', errorMessage);
    }
  };

  const handleSaveAllChanges = async () => {
    if (!tableData) return;

    try {
      // Group changes by row
      const changesByRow = Object.values(pendingChanges).reduce((acc, change) => {
        if (!acc[change.rowIndex]) {
          acc[change.rowIndex] = [];
        }
        acc[change.rowIndex].push(change);
        return acc;
      }, {} as Record<number, PendingChange[]>);

      // Save each row's changes
      const promises = Object.entries(changesByRow).map(async ([rowIndexStr, rowChanges]) => {
        const rowIndex = parseInt(rowIndexStr);
        const row = tableData.rows[rowIndex];
        const primaryKeyColumns = tableData.columns.filter(col => col.primary_key);
        const whereClause: Record<string, any> = {};

        primaryKeyColumns.forEach(col => {
          whereClause[col.name] = row[col.name];
        });

        const updateData: Record<string, any> = {};
        rowChanges.forEach(change => {
          updateData[change.columnName] = change.newValue;
        });

        await api.updateRow(tableName, updateData, whereClause);
      });

      await Promise.all(promises);

      // Clear all pending changes
      setPendingChanges({});
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error saving all changes:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Save All Changes', errorMessage);
    }
  };

  const handleAddNewRow = async () => {
    if (!tableData) return;

    try {
      await api.insertRow(tableName, newRowData);
      setNewRowData({});
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error adding new row:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Add New Row', errorMessage);
    }
  };

  const isNewRowValid = () => {
    if (!tableData) return false;

    return tableData.columns
      .filter(col => col.not_null && !col.primary_key)
      .every(col => newRowData[col.name] && String(newRowData[col.name]).trim() !== '');
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Row selection handlers
  const handleRowSelect = (rowIndex: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (!tableData) return;
    if (selectedRows.size === tableData.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableData.rows.map((_, index) => index)));
    }
  };

  // Bulk delete handler
  const handleBulkDelete = () => {
    if (!tableData || selectedRows.size === 0) return;

    showConfirm(
      'Delete Multiple Rows',
      `Are you sure you want to delete ${selectedRows.size} row(s)? This action cannot be undone.`,
      handleBulkDeleteConfirmed
    );
  };

  const handleBulkDeleteConfirmed = async () => {
    try {
      const primaryKeyColumns = tableData!.columns.filter(col => col.primary_key);
      if (primaryKeyColumns.length === 0) {
        showError('Cannot Delete Rows', 'This table has no primary key defined, which is required for row deletion.');
        return;
      }

      for (const rowIndex of selectedRows) {
        const row = tableData!.rows[rowIndex];
        const whereClause: Record<string, any> = {};

        primaryKeyColumns.forEach(col => {
          whereClause[col.name] = row[col.name];
        });

        await api.deleteRow(tableName, whereClause);
      }

      setSelectedRows(new Set());
      loadTableData();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error deleting rows:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Delete Rows', errorMessage);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getRowPendingChanges = (rowIndex: number) => {
    return Object.keys(pendingChanges).filter(key => key.startsWith(`${rowIndex}-`));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading table data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-300 p-4 bg-white">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">{tableName}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setEditModal({ isOpen: true, mode: 'insert' })}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm flex items-center gap-2"
            >
              <i className="ti ti-plus"></i>
              Add Row
            </button>
            <button
              onClick={loadTableData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm flex items-center gap-2"
              disabled={hasPendingChanges}
            >
              <i className="ti ti-refresh"></i>
              Refresh
            </button>
            {selectedRows.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm flex items-center gap-2"
                title={`Delete ${selectedRows.size} selected row(s)`}
              >
                <i className="ti ti-trash"></i>
                Delete Selected ({selectedRows.size})
              </button>
            )}
            {hasPendingChanges && (
              <>
                <button
                  onClick={handleSaveAllChanges}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm flex items-center gap-2"
                  title="Save all pending changes"
                >
                  <i className="ti ti-device-floppy"></i>
                  Save All ({Object.keys(pendingChanges).length})
                </button>
                <div className="px-3 py-2 bg-orange-100 text-orange-800 rounded text-sm flex items-center gap-2">
                  <i className="ti ti-alert-circle"></i>
                  Unsaved changes
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-max">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700 w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </th>
              {tableData.columns.map((column) => (
                <th
                  key={column.name}
                  className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700"
                >
                  <div className="flex flex-col">
                    <span>{column.name}</span>
                    <span className="text-xs text-gray-500 font-normal">
                      {column.type}
                      {column.primary_key && ' (PK)'}
                      {column.unique && ' (UNIQUE)'}
                      {column.not_null && ' (NOT NULL)'}
                    </span>
                  </div>
                </th>
              ))}
              <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-gray-50 group cursor-pointer ${selectedRows.has(index) ? 'bg-blue-50' : ''}`}
                onClick={() => handleRowSelect(index)}
              >
                <td className="border border-gray-300 px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(index)}
                    onChange={() => handleRowSelect(index)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                </td>
                {tableData.columns.map((column) => {
                  const changeKey = `${index}-${column.name}`;
                  const hasChange = changeKey in pendingChanges;
                  const isEditing = editingCell?.rowIndex === index && editingCell?.columnName === column.name;
                  const displayValue = hasChange ? pendingChanges[changeKey].newValue : row[column.name];

                  return (
                    <td
                      key={column.name}
                      className={`border border-gray-300 px-2 py-1 text-xs text-gray-900 ${hasChange ? 'bg-yellow-100' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type={getInputType(column.type)}
                              className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded"
                              defaultValue={displayValue === null ? '' : String(displayValue)}
                              autoFocus
                              onBlur={(e) => handleCellEdit(index, column.name, e.target.value, row[column.name])}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCellEdit(index, column.name, e.currentTarget.value, row[column.name]);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                            />
                          ) : (
                            <div
                              className="max-w-xs overflow-hidden text-ellipsis cursor-pointer whitespace-nowrap"
                              onDoubleClick={() => handleCellDoubleClick(index, column.name, row[column.name])}
                              title={displayValue === null ? 'NULL' : String(displayValue)}
                            >
                              {displayValue === null ? (
                                <span className="text-gray-400 italic">NULL</span>
                              ) : isBooleanColumn(column.type) ? (
                                <input
                                  type="checkbox"
                                  checked={getBooleanValue(displayValue)}
                                  readOnly
                                  className="pointer-events-none"
                                />
                              ) : (
                                String(displayValue)
                              )}
                            </div>
                          )}
                        </div>
                        {!isEditing && !column.not_null && !column.primary_key && (
                          <button
                            onClick={() => handleSetNull(index, column.name)}
                            className="px-1 py-0.5 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Set to NULL"
                          >
                            <i className="ti ti-x text-xs"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="border border-gray-300 px-2 py-1 text-xs">
                  <div className="flex gap-1">
                    {getRowPendingChanges(index).length > 0 ? (
                      <i
                        onClick={() => handleSaveChanges(index)}
                        className="ti ti-device-floppy text-orange-500 hover:text-orange-600 cursor-pointer text-lg"
                        title="Save changes for this row"
                      ></i>
                    ) : (
                      <>
                        <i
                          onClick={() => setEditModal({ isOpen: true, mode: 'update', data: row })}
                          className="ti ti-edit text-blue-500 hover:text-blue-600 cursor-pointer text-lg"
                          title="Edit row"
                        ></i>
                        <i
                          onClick={() => handleDelete(row)}
                          className="ti ti-trash text-red-500 hover:text-red-600 cursor-pointer text-lg"
                          title="Delete row"
                        ></i>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-green-50 group">
              <td className="border border-gray-300 px-2 py-1 text-center">
                <i className="ti ti-plus text-green-600"></i>
              </td>
              {tableData.columns.map((column) => (
                <td
                  key={column.name}
                  className="border border-gray-300 px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-1">
                    {getInputType(column.type) === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={getBooleanValue(newRowData[column.name])}
                        onChange={(e) => handleNewRowChange(column.name, e.target.checked ? 'true' : 'false')}
                        className="px-2 py-1 text-sm"
                        disabled={column.primary_key && column.name === 'id'}
                      />
                    ) : (
                      <input
                        type={getInputType(column.type)}
                        value={newRowData[column.name] || ''}
                        onChange={(e) => handleNewRowChange(column.name, e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder={column.primary_key ? 'Auto' : (column.not_null ? 'Required' : 'Optional')}
                        disabled={column.primary_key && column.name === 'id'}
                        required={column.not_null && !column.primary_key}
                      />
                    )}
                    {!column.not_null && !column.primary_key && (
                      <button
                        onClick={() => handleNewRowChange(column.name, null)}
                        className="px-1 py-0.5 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 flex items-center gap-1"
                        title="Set to NULL"
                        type="button"
                      >
                        <i className="ti ti-x text-xs"></i>
                      </button>
                    )}
                  </div>
                </td>
              ))}
              <td className="border border-gray-300 px-2 py-1 text-xs">
                <button
                  onClick={handleAddNewRow}
                  disabled={!isNewRowValid()}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    isNewRowValid()
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title="Add new row"
                >
                  <i className="ti ti-plus"></i>
                  Add
                </button>
              </td>
            </tr>
            {tableData.rows.length === 0 && (
              <tr>
                <td
                  colSpan={tableData.columns.length + 2}
                  className="border border-gray-300 px-2 py-4 text-center text-gray-500 text-xs"
                >
                  No data in this table
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-300 p-4 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {Math.min((currentPage - 1) * pageSize + 1, tableData.total)} - {Math.min(currentPage * pageSize, tableData.total)} of {tableData.total} rows
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {Math.ceil(tableData.total / pageSize)}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= Math.ceil(tableData.total / pageSize)}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
          >
            Next
          </button>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="ml-4 px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>
      </div>

      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, mode: 'insert' })}
        onSave={editModal.mode === 'insert' ? handleInsert : handleUpdate}
        columns={tableData.columns}
        initialData={editModal.mode === 'update' ? editModal.data : undefined}
        title={editModal.mode === 'insert' ? 'Add New Row' : 'Edit Row'}
      />

      <ErrorDialogComponent
        isOpen={errorDialog.isOpen}
        title={errorDialog.title}
        message={errorDialog.message}
        onClose={() => setErrorDialog({ isOpen: false, title: '', message: '' })}
      />

      <ConfirmDialogComponent
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  );
};