import React, { useState, useEffect, useRef } from 'react';
import { Column, ColumnFilter } from '../types';

interface ColumnFilterProps {
  column: Column;
  filter?: ColumnFilter;
  onChange: (filter: ColumnFilter | null) => void;
}

const getFilterType = (columnType: string): 'text' | 'number' | 'boolean' | 'date' => {
  const type = columnType.toLowerCase().trim();

  // Be more specific with boolean detection
  if (type === 'bool' || type === 'boolean') {
    return 'boolean';
  }

  // Be more specific with number detection - check for exact matches and common SQL types
  if (type === 'int' || type === 'integer' || type === 'real' || type === 'float' ||
      type === 'double' || type === 'numeric' || type === 'decimal' ||
      type.startsWith('int(') || type.startsWith('decimal(') || type.startsWith('numeric(')) {
    return 'number';
  }

  // Date/time detection
  if (type.includes('date') || type.includes('time') || type === 'timestamp') {
    return 'date';
  }

  // Default to text for everything else including varchar, char, text, etc.
  return 'text';
};

const getOperatorOptions = (filterType: 'text' | 'number' | 'boolean' | 'date') => {
  switch (filterType) {
    case 'text':
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'icontains', label: 'Contains (case-insensitive)' },
        { value: 'equals', label: 'Equals' },
        { value: 'iequals', label: 'Equals (case-insensitive)' },
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
  const [inputValue, setInputValue] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Initialize input value from filter
  useEffect(() => {
    if (filter?.value !== undefined && filter?.value !== null) {
      setInputValue(String(filter.value));
    } else {
      setInputValue('');
    }
  }, [filter?.value]);

  // Clear input when filter is removed
  useEffect(() => {
    if (!filter) {
      setInputValue('');
    }
  }, [filter]);

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
      setInputValue(String(initialValue));
    }
  };

  const handleInputChange = (value: string) => {
    if (!filter) return;

    // Update input state immediately
    setInputValue(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the actual filter change
    timeoutRef.current = setTimeout(() => {
      let finalValue: string | number | boolean | null = value;
      if (filterType === 'number') {
        if (value === '') {
          finalValue = 0;
        } else {
          const numValue = Number(value);
          // Only update if it's a valid number, otherwise keep the string for partial input
          if (!isNaN(numValue) && isFinite(numValue)) {
            finalValue = numValue;
          } else {
            // Don't update filter for invalid number input, let user continue typing
            return;
          }
        }
      }
      onChange({
        ...filter,
        value: finalValue
      });
    }, 500);
  };

  const handleNonStringValueChange = (value: number | boolean) => {
    if (!filter) return;

    onChange({
      ...filter,
      value
    });
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
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
              onChange={(e) => handleNonStringValueChange(e.target.value === 'true')}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select value</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : filterType === 'number' ? (
            <input
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter number"
            />
          ) : filterType === 'date' ? (
            <input
              type={column.type.toLowerCase().includes('datetime') || column.type.toLowerCase().includes('timestamp') ? 'datetime-local' :
                    column.type.toLowerCase().includes('time') ? 'time' : 'date'}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter text"
            />
          )}
        </div>
      )}
    </div>
  );
};