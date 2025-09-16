import React, { useState, useEffect, useRef } from 'react';

interface HexEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: string) => void;
  initialData?: string;
  title?: string;
}

interface HexLine {
  offset: number;
  bytes: number[];
  text: string;
}

export const HexEditorModal: React.FC<HexEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData = '',
  title = 'Hex Editor'
}) => {
  const [data, setData] = useState<Uint8Array>(new Uint8Array(0));
  const [lines, setLines] = useState<HexLine[]>([]);
  const [selectedByte, setSelectedByte] = useState<number | null>(null);
  const [editingByte, setEditingByte] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [pendingInput, setPendingInput] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  const BYTES_PER_LINE = 16;

  useEffect(() => {
    if (initialData) {
      try {
        let bytes: Uint8Array;

        if (initialData.startsWith('0x')) {
          // It's a hex string
          const hex = initialData.replace('0x', '');
          const hexBytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            hexBytes.push(parseInt(hex.substr(i, 2), 16));
          }
          bytes = new Uint8Array(hexBytes);
        } else if (/^[0-9a-fA-F]+$/.test(initialData) && initialData.length % 2 === 0) {
          // It's a pure hex string (even length)
          const hexBytes = [];
          for (let i = 0; i < initialData.length; i += 2) {
            hexBytes.push(parseInt(initialData.substr(i, 2), 16));
          }
          bytes = new Uint8Array(hexBytes);
        } else {
          // Treat as regular text (UTF-8)
          bytes = new Uint8Array(Array.from(initialData, char => char.charCodeAt(0)));
        }

        setData(bytes);
      } catch (error) {
        console.warn('Failed to parse initial data:', error);
        setData(new Uint8Array(0));
      }
    } else {
      setData(new Uint8Array(0));
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    const newLines: HexLine[] = [];
    for (let i = 0; i < data.length; i += BYTES_PER_LINE) {
      const lineBytes = Array.from(data.slice(i, i + BYTES_PER_LINE));
      const text = lineBytes.map(byte =>
        (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.'
      ).join('');

      newLines.push({
        offset: i,
        bytes: lineBytes,
        text
      });
    }

    // Add empty line if data is empty
    if (newLines.length === 0) {
      newLines.push({
        offset: 0,
        bytes: [],
        text: ''
      });
    }

    setLines(newLines);
  }, [data]);

  const handleByteClick = (lineIndex: number, byteIndex: number) => {
    const globalByteIndex = lineIndex * BYTES_PER_LINE + byteIndex;
    setSelectedByte(globalByteIndex);
  };

  const handleByteDoubleClick = (lineIndex: number, byteIndex: number) => {
    const globalByteIndex = lineIndex * BYTES_PER_LINE + byteIndex;
    if (globalByteIndex < data.length) {
      setEditingByte(globalByteIndex);
      setEditValue(data[globalByteIndex].toString(16).padStart(2, '0').toUpperCase());
      setSelectedByte(globalByteIndex);
    }
  };

  const handleEditSubmit = () => {
    if (editingByte === null || !/^[0-9a-fA-F]{1,2}$/i.test(editValue)) return;

    const newValue = parseInt(editValue, 16);
    if (isNaN(newValue)) return;

    const newData = new Uint8Array(data);
    newData[editingByte] = newValue;
    setData(newData);
    setEditingByte(null);
    setEditValue('');
  };

  const handleEditCancel = () => {
    setEditingByte(null);
    setEditValue('');
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    // Handle hex input (0-9, A-F, a-f)
    if (/^[0-9a-fA-F]$/.test(e.key)) {
      e.preventDefault();
      setPendingInput(prev => {
        const newInput = prev + e.key.toUpperCase();
        if (newInput.length === 2) {
          // Complete byte - add to data
          const newByte = parseInt(newInput, 16);
          const newData = new Uint8Array(data.length + 1);
          newData.set(data);
          newData[data.length] = newByte;
          setData(newData);
          setSelectedByte(data.length); // Select the new byte
          return ''; // Clear pending input
        }
        return newInput;
      });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (pendingInput) {
        // Clear pending input first
        setPendingInput('');
      } else if (selectedByte !== null && selectedByte < data.length) {
        // Delete selected byte
        const newData = new Uint8Array(data.length - 1);
        newData.set(data.slice(0, selectedByte));
        newData.set(data.slice(selectedByte + 1), selectedByte);
        setData(newData);
        // Adjust selection
        if (selectedByte >= newData.length) {
          setSelectedByte(newData.length - 1);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPendingInput('');
      setSelectedByte(null);
    }
  };

  // Add keypress handler only when modal is open and focused
  useEffect(() => {
    if (!isOpen) return;

    const modalContent = contentRef.current;
    if (!modalContent) return;

    modalContent.addEventListener('keydown', handleKeyPress);
    // Focus the content area when modal opens so it can receive keyboard events
    modalContent.focus();

    return () => {
      modalContent.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, data, selectedByte, pendingInput]);


  const handleAddByte = () => {
    const newData = new Uint8Array(data.length + 1);
    newData.set(data);
    newData[data.length] = 0;
    setData(newData);
  };

  const handleSave = () => {
    // Convert Uint8Array back to hex string
    const hexString = '0x' + Array.from(data, byte =>
      ('0' + (byte & 0xFF).toString(16)).slice(-2)
    ).join('');
    onSave(hexString);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-5/6 max-w-7xl h-5/6 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <i className="ti ti-x text-xl"></i>
          </button>
        </div>

        <div className="flex-1 p-4 overflow-auto">
          <div
            ref={contentRef}
            className="font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-4 h-full overflow-auto outline-none"
            tabIndex={0}
          >
            {/* Header */}
            <div className="flex mb-3 text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 pb-3 font-bold">
              <div className="w-24 text-right mr-6">Offset</div>
              <div className="flex-1 flex gap-2">
                {Array.from({length: 16}, (_, i) => (
                  <div key={i} className="w-8 text-center text-xs">
                    {i.toString(16).toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="w-40 ml-6">ASCII</div>
            </div>

            {/* Data rows */}
            {lines.map((line, lineIndex) => (
              <div key={lineIndex} className="flex mb-2 hover:bg-gray-100 dark:hover:bg-gray-800 py-1 rounded">
                {/* Offset */}
                <div className="w-24 text-right mr-6 text-gray-600 dark:text-gray-400 py-1">
                  {line.offset.toString(16).padStart(8, '0').toUpperCase()}
                </div>

                {/* Hex bytes */}
                <div className="flex-1 flex gap-2">
                  {Array.from({length: BYTES_PER_LINE}, (_, byteIndex) => {
                    const globalByteIndex = lineIndex * BYTES_PER_LINE + byteIndex;
                    const byte = line.bytes[byteIndex];
                    const isSelected = selectedByte === globalByteIndex;
                    const hasData = byteIndex < line.bytes.length;

                    const isEditing = editingByte === globalByteIndex;

                    return (
                      <div
                        key={byteIndex}
                        className={`w-8 text-center cursor-pointer py-1 px-1 rounded border ${
                          hasData
                            ? isSelected
                              ? 'bg-blue-500 text-white border-blue-600'
                              : 'text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600'
                            : globalByteIndex === data.length && pendingInput
                            ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600'
                            : 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => {
                          setSelectedByte(globalByteIndex);
                          setPendingInput(''); // Clear any pending input when selecting
                        }}
                        onDoubleClick={() => hasData && handleByteDoubleClick(lineIndex, byteIndex)}
                        title={hasData ? 'Click to select, delete to remove' : globalByteIndex === data.length ? 'Type hex characters to add bytes' : 'Empty - type to add bytes here'}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                            onBlur={handleEditSubmit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSubmit();
                              if (e.key === 'Escape') handleEditCancel();
                            }}
                            className="w-full text-center text-xs bg-yellow-200 dark:bg-yellow-600 text-black border-none outline-none"
                            maxLength={2}
                            autoFocus
                          />
                        ) : globalByteIndex === data.length && pendingInput ? (
                          // Show pending input for next byte
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {pendingInput.padEnd(2, '_')}
                          </span>
                        ) : (
                          hasData ? byte.toString(16).padStart(2, '0').toUpperCase() : '  '
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ASCII representation */}
                <div className="w-40 ml-6 py-1 px-3 text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                  {line.text || ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-start gap-4 p-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Size: {data.length} bytes
              </div>
              {pendingInput && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 font-mono">
                  Typing: {pendingInput}_
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>• Type hex characters (0-9, A-F) to add new bytes</div>
              <div>• Click to select bytes • Delete/Backspace to remove bytes</div>
              <div>• Double-click existing bytes to edit • Escape to clear selection</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};