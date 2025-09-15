import React from 'react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'ti ti-sun' },
    { value: 'dark', label: 'Dark', icon: 'ti ti-moon' },
    { value: 'system', label: 'System', icon: 'ti ti-device-desktop' },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[2];

  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeMode)}
        className="appearance-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Theme selection"
      >
        {themes.map((themeOption) => (
          <option
            key={themeOption.value}
            value={themeOption.value}
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {themeOption.label}
          </option>
        ))}
      </select>

      {/* Custom arrow icon */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <i className="ti ti-chevron-down text-gray-500 dark:text-gray-400 text-sm"></i>
      </div>

      {/* Theme icon indicator */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <i className={`${currentTheme.icon} text-gray-500 dark:text-gray-400 text-sm`}></i>
      </div>
    </div>
  );
}