import React, { useState, useEffect } from 'react';
import { Column } from '../types';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  columns: Column[];
  initialData?: Record<string, any>;
  title: string;
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

const getBooleanValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1';
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

export const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, columns, initialData, title }) => {
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[600px] max-h-[600px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
        <form onSubmit={handleSubmit}>
          {columns.map((column) => (
            <div key={column.name} className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {column.name}
                {column.not_null && <span className="text-red-500">*</span>}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({column.type})</span>
              </label>
{getInputType(column.type) === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={getBooleanValue(formData[column.name])}
                  onChange={(e) => setFormData({ ...formData, [column.name]: e.target.checked ? 'true' : 'false' })}
                  className="rounded"
                  disabled={column.primary_key && !!initialData}
                />
              ) : (
                <input
                  type={getInputType(column.type)}
                  value={
                    getInputType(column.type) === 'date' || getInputType(column.type) === 'time' || getInputType(column.type) === 'datetime-local'
                      ? getDateValue(formData[column.name], getInputType(column.type))
                      : formData[column.name] || ''
                  }
                  onChange={(e) => setFormData({ ...formData, [column.name]: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required={column.not_null}
                  disabled={column.primary_key && !!initialData}
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};