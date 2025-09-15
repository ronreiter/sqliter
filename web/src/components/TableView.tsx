import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TableData, Column, FilterState, ColumnFilter } from '../types';
import { api } from '../api';
import { EditModal } from './EditModal';
import { ErrorDialog } from './ErrorDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ColumnFilterComponent } from './ColumnFilter';
import { HexEditorModal } from './HexEditor';

interface TableViewProps {
  tableName: string;
  onRefresh?: () => void;
  onPendingChangesUpdate?: (tableName: string, count: number) => void;
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
  if (type.includes('int') || type.includes('real') || type.includes('float') || type.includes('double') || type.includes('numeric') || type.includes('decimal')) {
    return 'number';
  }
  if (type.includes('blob') || type.includes('binary')) {
    return 'blob';
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

const getDateValue = (value: any, inputType: string): string => {
  if (!value || value === null || value === undefined) return '';

  const dateStr = String(value);
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    if (inputType === 'date') {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (inputType === 'time') {
      return date.toTimeString().split(' ')[0].slice(0, 5); // HH:MM
    } else if (inputType === 'datetime-local') {
      // YYYY-MM-DDTHH:MM
      const isoString = date.toISOString();
      return isoString.slice(0, 16);
    }
  } catch (error) {
    console.warn('Failed to parse date:', dateStr);
  }

  return String(value);
};

const formatDateForDisplay = (value: any, columnType: string): string => {
  if (!value || value === null || value === undefined) return '';

  const dateStr = String(value);
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return original if not a valid date

    const type = columnType.toLowerCase();

    if (type.includes('datetime') || type.includes('timestamp')) {
      // Format as: "Sep 13, 2025 2:43 PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (type === 'date' || (type.includes('date') && !type.includes('datetime'))) {
      // Format as: "Sep 13, 2025" (date only, no time)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } else if (type.includes('time')) {
      // Format as: "2:43 PM"
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch (error) {
    console.warn('Failed to format date for display:', dateStr);
  }

  return dateStr; // Return original value if formatting fails
};

const isBooleanColumn = (columnType: string): boolean => {
  const type = columnType.toLowerCase();
  return type.includes('bool') || type.includes('boolean');
};

const isBlobColumn = (columnType: string): boolean => {
  const type = columnType.toLowerCase();
  return type.includes('blob') || type.includes('binary');
};

const formatBlobForDisplay = (value: any): string => {
  if (!value || value === null || value === undefined) return '';

  const str = String(value);
  if (str.length === 0) return '[Empty BLOB]';

  // Show first few bytes and total size
  const bytes = Math.ceil(str.length / 2); // Assuming hex representation
  const preview = str.length > 20 ? str.substring(0, 20) + '...' : str;
  return `[BLOB ${bytes} bytes] ${preview}`;
};

const getBooleanValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1';
};

const isUrl = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const urlRegex = /^https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)*(?:\?(?:[;&\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)?(?:#(?:[\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)?$/i;
  return urlRegex.test(str.trim());
};

const renderTextWithUrls = (text: string): JSX.Element => {
  const urlRegex = /(https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)*(?:\?(?:[;&\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)?(?:#(?:[\w._~!$&'()*+,;=:@-]|%[\dA-F]{2})*)?)/gi;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 underline"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
};




export const TableView: React.FC<TableViewProps> = ({ tableName, onRefresh, onPendingChangesUpdate }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    mode: 'insert' | 'update';
    data?: Record<string, any>;
  }>({ isOpen: false, mode: 'insert' });

  // Hex editor modal state
  const [hexEditor, setHexEditor] = useState<{
    isOpen: boolean;
    data: string;
    columnName: string;
    rowIndex: number;
  }>({ isOpen: false, data: '', columnName: '', rowIndex: -1 });

  // New state for inline editing and unsaved changes
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [newRowData, setNewRowData] = useState<NewRowData>({});

  // Row selection and pagination state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});

  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Load column widths from session storage for this table
    const saved = sessionStorage.getItem(`columnWidths_${tableName}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [isResizing, setIsResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);

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

  // Save column widths to session storage whenever they change
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      sessionStorage.setItem(`columnWidths_${tableName}`, JSON.stringify(columnWidths));
    }
  }, [columnWidths, tableName]);

  const buildFilterQuery = (): string[] => {
    const conditions: string[] = [];

    // Safety check for filters object
    if (!filters || typeof filters !== 'object') {
      return conditions;
    }

    Object.values(filters).forEach(filter => {
      if (!filter || !filter.columnName || typeof filter !== 'object') {
        return; // Skip invalid filters
      }

      const columnName = filter.columnName;

      switch (filter.operator) {
        case 'contains':
          if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
            const safeValue = String(filter.value).replace(/'/g, "''");
            conditions.push(`${columnName} LIKE '%${safeValue}%'`);
          }
          break;
        case 'equals':
          if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
            if (typeof filter.value === 'string') {
              conditions.push(`${columnName} = '${String(filter.value).replace(/'/g, "''")}'`);
            } else {
              conditions.push(`${columnName} = ${filter.value}`);
            }
          }
          break;
        case 'greater':
          if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
            conditions.push(`${columnName} > ${filter.value}`);
          }
          break;
        case 'less':
          if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
            conditions.push(`${columnName} < ${filter.value}`);
          }
          break;
        case 'null':
          conditions.push(`${columnName} IS NULL`);
          break;
        case 'not_null':
          conditions.push(`${columnName} IS NOT NULL`);
          break;
        case 'true':
          conditions.push(`${columnName} = 1 OR ${columnName} = 'true' OR ${columnName} = 'True'`);
          break;
        case 'false':
          conditions.push(`${columnName} = 0 OR ${columnName} = 'false' OR ${columnName} = 'False' OR ${columnName} IS NULL`);
          break;
      }
    });

    return conditions;
  };

  const loadTableData = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const whereConditions = buildFilterQuery();
      const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : undefined;

      const data = await api.getTableData(
        tableName,
        pageSize,
        offset,
        sortColumn || undefined,
        sortColumn ? sortDirection : undefined,
        whereClause
      );
      setTableData(data);
      setError(null);
      // Clear selections when loading new data
      setSelectedRows(new Set());
      // Clear pending changes when refreshing
      setPendingChanges({});
      setEditingCell(null);
    } catch (err) {
      setError('Failed to load table data');
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset sorting, filtering, and pagination when table changes
  useEffect(() => {
    setSortColumn(null);
    setSortDirection('asc');
    setFilters({});
    setCurrentPage(1);
    setShowFilters(false);
    // Clear URL parameters when switching tables
    setSearchParams({}, { replace: true });
  }, [tableName]);

  useEffect(() => {
    loadTableData();
  }, [tableName, currentPage, pageSize, sortColumn, sortDirection, filters]);

  // URL state management for filters, sorting, and pagination
  useEffect(() => {
    // Load sorting from URL
    const urlSortColumn = searchParams.get('sort');
    const urlSortDirection = searchParams.get('direction') as 'asc' | 'desc';
    if (urlSortColumn && urlSortDirection) {
      setSortColumn(urlSortColumn);
      setSortDirection(urlSortDirection);
    }

    // Load page size from URL
    const urlPageSize = searchParams.get('pageSize');
    if (urlPageSize && !isNaN(Number(urlPageSize))) {
      const pageSizeNum = Number(urlPageSize);
      if ([10, 25, 50, 100, 200, 1000].includes(pageSizeNum)) {
        setPageSize(pageSizeNum);
      }
    }

    // Load current page from URL
    const urlPage = searchParams.get('page');
    if (urlPage && !isNaN(Number(urlPage))) {
      const pageNum = Number(urlPage);
      if (pageNum > 0) {
        setCurrentPage(pageNum);
      }
    }

    // Load filters from URL
    const urlFilters: FilterState = {};
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter_')) {
        try {
          const filterData = JSON.parse(decodeURIComponent(value));
          const columnName = key.replace('filter_', '');

          // Validate filter data structure
          if (filterData &&
              typeof filterData.filterType === 'string' &&
              typeof filterData.operator === 'string') {
            urlFilters[columnName] = {
              ...filterData,
              columnName
            };
          } else {
            console.warn('Invalid filter data structure:', filterData);
          }
        } catch (e) {
          console.warn('Failed to parse filter from URL:', key, value, e);
        }
      }
    }
    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
      setShowFilters(true);
    }
  }, [searchParams]);

  // Update URL when filters, sorting, or pagination change
  useEffect(() => {
    const params = new URLSearchParams();

    // Add sorting to URL
    if (sortColumn && sortDirection) {
      params.set('sort', sortColumn);
      params.set('direction', sortDirection);
    }

    // Add pagination to URL
    if (pageSize !== 10) { // Only add if not default value
      params.set('pageSize', pageSize.toString());
    }
    if (currentPage !== 1) { // Only add if not first page
      params.set('page', currentPage.toString());
    }

    // Add filters to URL
    Object.entries(filters).forEach(([columnName, filter]) => {
      const filterData = {
        filterType: filter.filterType,
        operator: filter.operator,
        value: filter.value
      };
      params.set(`filter_${columnName}`, encodeURIComponent(JSON.stringify(filterData)));
    });

    setSearchParams(params, { replace: true });
  }, [sortColumn, sortDirection, pageSize, currentPage, filters, setSearchParams]);

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
  const handleCellDoubleClick = (rowIndex: number, columnName: string) => {
    setEditingCell({ rowIndex, columnName });
  };

  const handleCellEdit = (rowIndex: number, columnName: string, newValue: any, originalValue: any) => {
    const changeKey = `${rowIndex}-${columnName}`;

    // Normalize values for comparison
    const normalizeValue = (val: any) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'boolean') return val.toString();
      if (typeof val === 'string') {
        // Handle boolean-like strings
        if (val.toLowerCase() === 'true') return 'true';
        if (val.toLowerCase() === 'false') return 'false';
      }
      return String(val);
    };

    const normalizedNew = normalizeValue(newValue);
    const normalizedOriginal = normalizeValue(originalValue);

    if (normalizedNew !== normalizedOriginal) {
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

  // BLOB handling functions
  const handleBlobEdit = (rowIndex: number, columnName: string, currentValue: any) => {
    setHexEditor({
      isOpen: true,
      data: currentValue || '',
      columnName,
      rowIndex
    });
  };

  const handleBlobSave = (newValue: string) => {
    if (hexEditor.rowIndex === -2) {
      // Special case for new row
      handleNewRowChange(hexEditor.columnName, newValue);
    } else if (tableData && hexEditor.rowIndex >= 0) {
      // Existing row edit
      const originalValue = tableData.rows[hexEditor.rowIndex][hexEditor.columnName];
      handleCellEdit(hexEditor.rowIndex, hexEditor.columnName, newValue, originalValue);
    }
    setHexEditor({ isOpen: false, data: '', columnName: '', rowIndex: -1 });
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
    if (!tableData || !tableData.rows || !Array.isArray(tableData.rows)) return;
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
    if (!tableData || !tableData.columns || !Array.isArray(tableData.columns)) {
      showError('Cannot Delete Rows', 'Table data is not available.');
      return;
    }

    try {
      const primaryKeyColumns = tableData.columns.filter(col => col && col.primary_key);
      if (!primaryKeyColumns || primaryKeyColumns.length === 0) {
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

  // Revert all pending changes for a specific row
  const handleRevertRowChanges = (rowIndex: number) => {
    const rowChanges = getRowPendingChanges(rowIndex);
    const updatedPendingChanges = { ...pendingChanges };

    // Remove all pending changes for this row
    rowChanges.forEach(key => {
      delete updatedPendingChanges[key];
    });

    setPendingChanges(updatedPendingChanges);
  };

  // Revert a specific cell change
  const handleRevertCellChange = (rowIndex: number, columnName: string) => {
    const changeKey = `${rowIndex}-${columnName}`;
    const updatedPendingChanges = { ...pendingChanges };

    delete updatedPendingChanges[changeKey];

    setPendingChanges(updatedPendingChanges);
  };

  // Filter handlers
  const handleFilterChange = (columnName: string, filter: ColumnFilter | null) => {
    setFilters(prev => {
      if (filter === null) {
        const { [columnName]: removed, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [columnName]: filter
        };
      }
    });
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Sorting handler
  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  // Helper function to get sort icon
  const getSortIcon = (columnName: string) => {
    if (sortColumn !== columnName) {
      return <i className="ti ti-selector text-gray-400 ml-1"></i>;
    }

    if (sortDirection === 'asc') {
      return <i className="ti ti-chevron-up text-blue-600 ml-1"></i>;
    } else {
      return <i className="ti ti-chevron-down text-blue-600 ml-1"></i>;
    }
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const currentWidth = columnWidths[columnName] || 150; // Default width
    setIsResizing({ column: columnName, startX, startWidth: currentWidth });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - isResizing.startX;
    const newWidth = Math.max(50, isResizing.startWidth + deltaX); // Minimum width of 50px
    setColumnWidths(prev => ({
      ...prev,
      [isResizing.column]: newWidth
    }));
  };

  const handleResizeEnd = () => {
    setIsResizing(null);
  };

  // Mouse event listeners for column resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
      };
    }
  }, [isResizing]);

  // Get column width
  const getColumnWidth = (columnName: string) => {
    return columnWidths[columnName] || 200; // Default width
  };

  // CSV export handler
  const handleExportCSV = async () => {
    try {
      const whereConditions = buildFilterQuery();
      const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : undefined;

      const blob = await api.exportTableCSV(
        tableName,
        sortColumn || undefined,
        sortColumn ? sortDirection : undefined,
        whereClause
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tableName}_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      showError('Failed to Export CSV', errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading table data...</div>
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
        <div className="text-gray-500 dark:text-gray-400">No data available</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{tableName}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setEditModal({ isOpen: true, mode: 'insert' })}
              className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-800 text-sm flex items-center gap-2"
            >
              <i className="ti ti-plus"></i>
              Add Row
            </button>
            <button
              onClick={() => {
                if (hasPendingChanges) {
                  showConfirm(
                    'Unsaved Changes',
                    'You have unsaved changes. Refreshing will discard them. Continue?',
                    loadTableData
                  );
                } else {
                  loadTableData();
                }
              }}
              className={`px-4 py-2 ${loading ? 'bg-gray-400 dark:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'} text-white rounded text-sm flex items-center gap-2 transition-colors`}
              disabled={loading}
            >
              <i className={`ti ${loading ? 'ti-loader animate-spin' : 'ti-refresh'}`}></i>
              {loading ? 'Loading...' : 'Refresh'}
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

      <div className="border-t border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between text-xs">
        <div className="text-gray-600 dark:text-gray-300">
          Showing {Math.min((currentPage - 1) * pageSize + 1, tableData.total)} - {Math.min(currentPage * pageSize, tableData.total)} of {tableData.total} rows
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-xs text-gray-900 dark:text-gray-100 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-300">
            Page {currentPage} of {Math.ceil(tableData.total / pageSize)}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= Math.ceil(tableData.total / pageSize)}
            className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-xs text-gray-900 dark:text-gray-100 transition-colors"
          >
            Next
          </button>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="ml-3 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
            <option value={1000}>1,000 per page</option>
          </select>
          <button
            onClick={toggleFilters}
            className={`ml-3 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs flex items-center gap-1 ${
              showFilters ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Toggle filters"
          >
            <i className="ti ti-filter"></i>
            Filters
            {Object.keys(filters).length > 0 && (
              <span className="bg-blue-500 text-white rounded-full text-xs px-1 min-w-[16px] h-4 flex items-center justify-center">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
          {Object.keys(filters).length > 0 && (
            <button
              onClick={handleClearAllFilters}
              className="ml-2 px-2 py-1 bg-red-100 text-red-700 border border-red-300 rounded text-xs hover:bg-red-200"
              title="Clear all filters"
            >
              <i className="ti ti-x"></i>
              Clear
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="ml-3 px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-600 rounded text-xs hover:bg-green-200 dark:hover:bg-green-700 flex items-center gap-1"
            title="Export table data as CSV"
          >
            <i className="ti ti-download"></i>
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-h-0 max-h-0">
        <table className="w-full border-collapse min-w-max bg-white dark:bg-gray-800" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 w-12">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={tableData.rows && selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </div>
              </th>
              {(tableData.columns || []).map((column) => (
                <th
                  key={column.name}
                  className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-200 relative"
                  style={{ width: getColumnWidth(column.name), minWidth: '50px' }}
                >
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 -mx-2 -my-1 px-2 py-1 rounded transition-colors"
                      onClick={() => handleSort(column.name)}
                      title={`Sort by ${column.name}`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span>{column.name}</span>
                          {column.primary_key && <span className="text-yellow-600 ml-1">🔑</span>}
                          {column.unique && !column.primary_key && <span className="text-purple-600 ml-1">🔒</span>}
                          {column.not_null && <span className="text-red-600 ml-1">*</span>}
                          {filters[column.name] && <span className="text-blue-600 ml-1">🔍</span>}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                          {column.type}
                          {column.primary_key && ' (PK)'}
                          {column.unique && ' (UNIQUE)'}
                          {column.not_null && ' (NOT NULL)'}
                        </span>
                      </div>
                      {getSortIcon(column.name)}
                    </div>
                    {showFilters && (
                      <ColumnFilterComponent
                        column={column}
                        filter={filters[column.name]}
                        onChange={(filter) => handleFilterChange(column.name, filter)}
                      />
                    )}
                  </div>
                  {/* Column resize handle */}
                  <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-300 bg-transparent transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, column.name)}
                    title="Resize column"
                  />
                </th>
              ))}
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-xs font-medium text-gray-700 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {(tableData.rows || []).map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 group cursor-pointer transition-colors ${selectedRows.has(index) ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
                onClick={() => handleRowSelect(index)}
              >
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(index)}
                    onChange={() => handleRowSelect(index)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                </td>
                {(tableData.columns || []).map((column) => {
                  const changeKey = `${index}-${column.name}`;
                  const hasChange = changeKey in pendingChanges;
                  const isEditing = editingCell?.rowIndex === index && editingCell?.columnName === column.name;
                  const displayValue = hasChange ? pendingChanges[changeKey].newValue : row[column.name];

                  return (
                    <td
                      key={column.name}
                      className={`border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 overflow-hidden ${hasChange ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}
                      style={{ width: getColumnWidth(column.name), minWidth: '50px' }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 overflow-hidden">
                          {isEditing ? (
                            getInputType(column.type) === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={getBooleanValue(displayValue)}
                                autoFocus
                                onChange={(e) => handleCellEdit(index, column.name, e.target.checked ? 'true' : 'false', row[column.name])}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    const newValue = !getBooleanValue(displayValue);
                                    handleCellEdit(index, column.name, newValue ? 'true' : 'false', row[column.name]);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            ) : (
                              <input
                                type={getInputType(column.type)}
                                className="w-full h-8 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                defaultValue={
                                  displayValue === null ? '' :
                                  (['date', 'time', 'datetime-local'].includes(getInputType(column.type))) ?
                                    getDateValue(displayValue, getInputType(column.type)) :
                                    String(displayValue)
                                }
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
                            )
                          ) : (
                            <div
                              className="w-full overflow-hidden text-ellipsis cursor-pointer whitespace-nowrap"
                              onDoubleClick={isBlobColumn(column.type) ? undefined : () => handleCellDoubleClick(index, column.name, row[column.name])}
                              title={displayValue === null ? 'NULL' : String(displayValue)}
                            >
                              {displayValue === null ? (
                                <span className="text-gray-400 italic">NULL</span>
                              ) : isBooleanColumn(column.type) ? (
                                <input
                                  type="checkbox"
                                  checked={getBooleanValue(displayValue)}
                                  onChange={(e) => {
                                    const newValue = e.target.checked ? 'true' : 'false';
                                    handleCellEdit(index, column.name, newValue, row[column.name]);
                                  }}
                                  className="cursor-pointer"
                                />
                              ) : isBlobColumn(column.type) ? (
                                <span
                                  className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                  onClick={() => handleBlobEdit(index, column.name, displayValue)}
                                  onDoubleClick={() => handleBlobEdit(index, column.name, displayValue)}
                                  title="Click or double-click to edit BLOB data"
                                >
                                  {formatBlobForDisplay(displayValue)}
                                </span>
                              ) : (
                                renderTextWithUrls(
                                  (column.type.toLowerCase().includes('date') ||
                                   column.type.toLowerCase().includes('time')) ?
                                    formatDateForDisplay(displayValue, column.type) :
                                    String(displayValue)
                                )
                              )}
                            </div>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => isBlobColumn(column.type)
                                ? handleBlobEdit(index, column.name, displayValue)
                                : handleCellDoubleClick(index, column.name, row[column.name])}
                              className="px-1 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={isBlobColumn(column.type) ? "Edit BLOB data" : "Edit cell"}
                            >
                              <i className="ti ti-edit text-xs"></i>
                            </button>
                            {!column.not_null && !column.primary_key && (
                              <button
                                onClick={() => handleSetNull(index, column.name)}
                                className="px-1 py-0.5 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Set to NULL"
                              >
                                <i className="ti ti-x text-xs"></i>
                              </button>
                            )}
                            {hasChange && (
                              <button
                                onClick={() => handleRevertCellChange(index, column.name)}
                                className="px-1 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Revert this cell"
                              >
                                <i className="ti ti-arrow-back-up text-xs"></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs">
                  <div className="flex gap-1">
                    {getRowPendingChanges(index).length > 0 ? (
                      <>
                        <i
                          onClick={() => handleSaveChanges(index)}
                          className="ti ti-device-floppy text-orange-500 hover:text-orange-600 cursor-pointer text-lg"
                          title="Save changes for this row"
                        ></i>
                      </>
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
            <tr className="bg-green-50 dark:bg-green-900 group">
              <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                <i className="ti ti-plus text-green-600 dark:text-green-400"></i>
              </td>
              {(tableData.columns || []).map((column) => (
                <td
                  key={column.name}
                  className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs"
                  style={{ width: getColumnWidth(column.name), minWidth: '50px' }}
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
                    ) : getInputType(column.type) === 'blob' ? (
                      <input
                        type="text"
                        value={newRowData[column.name] ? formatBlobForDisplay(newRowData[column.name]) : ''}
                        onClick={() => {
                          setHexEditor({
                            isOpen: true,
                            data: newRowData[column.name] || '',
                            columnName: column.name,
                            rowIndex: -2 // Special value for new row
                          });
                        }}
                        readOnly
                        placeholder="Click to edit binary data"
                        className="flex-1 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
                        disabled={column.primary_key && column.name === 'id'}
                      />
                    ) : (
                      <input
                        type={getInputType(column.type)}
                        value={newRowData[column.name] || ''}
                        onChange={(e) => handleNewRowChange(column.name, e.target.value)}
                        className="flex-1 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
              <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs">
                <button
                  onClick={handleAddNewRow}
                  disabled={!isNewRowValid()}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    isNewRowValid()
                      ? 'bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-800'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                  title="Add new row"
                >
                  <i className="ti ti-plus"></i>
                  Add
                </button>
              </td>
            </tr>
            {(!tableData.rows || tableData.rows.length === 0) && (
              <tr>
                <td
                  colSpan={(tableData.columns || []).length + 2}
                  className="border border-gray-300 dark:border-gray-600 px-2 py-4 text-center text-gray-500 dark:text-gray-400 text-xs"
                >
                  No data in this table
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      <ErrorDialog
        isOpen={errorDialog.isOpen}
        title={errorDialog.title}
        message={errorDialog.message}
        onClose={() => setErrorDialog({ isOpen: false, title: '', message: '' })}
      />

      <HexEditorModal
        isOpen={hexEditor.isOpen}
        onClose={() => setHexEditor({ isOpen: false, data: '', columnName: '', rowIndex: -1 })}
        onSave={handleBlobSave}
        initialData={hexEditor.data}
        title={`Edit BLOB: ${hexEditor.columnName}`}
      />

      <ConfirmDialog
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