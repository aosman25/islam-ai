import { useState, useEffect } from 'react';

/**
 * Custom hook that persists state to localStorage
 * @param key - The localStorage key to use
 * @param initialValue - The initial value if no stored value exists
 * @returns [state, setState] - Same interface as useState
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial state from localStorage or use initialValue
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
        return JSON.parse(storedValue) as T;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error loading persisted state for key "${key}":`, error);
      return initialValue;
    }
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving persisted state for key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}
