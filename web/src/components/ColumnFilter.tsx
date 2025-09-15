import React, { useState, useEffect, useRef } from 'react';
import { Column, ColumnFilter } from '../types';

interface ColumnFilterProps {
  column: Column;
  filter?: ColumnFilter;
  onChange: (filter: ColumnFilter | null) => void;
}

const getFilterType = (columnType: string): 'text' | 'number' | 'boolean' | 'date' => {
  const type = columnType.toLowerCase();
  if (type.includes('bool') || type.includes('boolean')) {
    return 'boolean';
  }
  if (type.includes('int') || type.includes('real') || type.includes('numeric') || type.includes('decimal')) {
    return 'number';
  }
  if (type.includes('date') || type.includes('time')) {
    return 'date';
  }
  return 'text';
};

const getOperatorOptions = (filterType: 'text' | 'number' | 'boolean' | 'date') => {
  switch (filterType) {
    case 'text':
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'equals', label: 'Equals' },
        { value: 'null', label: 'Is NULL' },
        { value: 'not_null', label: 'Is not NULL' }
      ];
    case 'number':
    case 'date':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater', label: 'Greater than' },
        { value: 'less', label: 'Less than' },
        { value: 'null', label: 'Is NULL' },
        { value: 'not_null', label: 'Is not NULL' }
      ];
    case 'boolean':
      return [
        { value: 'true', label: 'True' },
        { value: 'false', label: 'False' },
        { value: 'null', label: 'Is NULL' },
        { value: 'not_null', label: 'Is not NULL' }
      ];
  }
};

export const ColumnFilterComponent: React.FC<ColumnFilterProps> = ({ column, filter, onChange }) => {
  const filterType = getFilterType(column.type);
  const operatorOptions = getOperatorOptions(filterType);
  const [localValue, setLocalValue] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Initialize local value from filter
  useEffect(() => {
    if (filter?.value !== undefined && filter?.value !== null) {
      setLocalValue(String(filter.value));
    } else {
      setLocalValue('');
    }
  }, [filter?.value]);

  // Safety check for filter object
  if (!filter && localValue !== '') {
    setLocalValue('');
  }

  const handleOperatorChange = (operator: string) => {
    if (operator === 'null' || operator === 'not_null') {
      onChange({
        columnName: column.name,
        filterType,
        operator: operator as any,
        value: null
      });
    } else if (operator === 'true' || operator === 'false') {
      onChange({
        columnName: column.name,
        filterType,
        operator: operator as any,
        value: operator === 'true'
      });
    } else {
      const initialValue = filterType === 'number' ? 0 : '';
      onChange({
        columnName: column.name,
        filterType,
        operator: operator as any,
        value: initialValue
      });
      setLocalValue(String(initialValue));
    }
  };

  const handleValueChange = (value: string | number | boolean) => {
    if (!filter) return;

    if (typeof value === 'string') {
      setLocalValue(value);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce the onChange call
      timeoutRef.current = setTimeout(() => {
        onChange({
          ...filter,
          value: filterType === 'number' ? (value === '' ? 0 : Number(value)) : value
        });
      }, 300); // 300ms debounce
    } else {
      onChange({
        ...filter,
        value
      });
    }
  };

  const handleClear = () => {
    onChange(null);
    setLocalValue('');
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const needsValueInput = filter && !['null', 'not_null', 'true', 'false'].includes(filter.operator);

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={filter?.operator ?? ''}
          onChange={(e) => e.target.value ? handleOperatorChange(e.target.value) : handleClear()}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 min-w-0 flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">No filter</option>
          {operatorOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {filter && (
          <button
            onClick={handleClear}
            className="text-red-500 hover:text-red-700"
            title="Clear filter"
          >
            <i className="ti ti-x text-xs"></i>
          </button>
        )}
      </div>

      {needsValueInput && filter && (
        <div>
          {filterType === 'boolean' ? (
            <select
              value={filter.value === true ? 'true' : filter.value === false ? 'false' : ''}
              onChange={(e) => handleValueChange(e.target.value === 'true')}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select value</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : filterType === 'number' ? (
            <input
              type="number"
              value={localValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter number"
            />
          ) : filterType === 'date' ? (
            <input
              type={column.type.toLowerCase().includes('datetime') || column.type.toLowerCase().includes('timestamp') ? 'datetime-local' :
                    column.type.toLowerCase().includes('time') ? 'time' : 'date'}
              value={localValue || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          ) : (
            <input
              type="text"
              value={localValue || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter text"
            />
          )}
        </div>
      )}
    </div>
  );
};