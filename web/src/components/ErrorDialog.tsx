import React from 'react';

interface ErrorDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <i className="ti ti-alert-circle text-red-500 text-2xl"></i>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">{title}</h3>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};