'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ViewMode } from '@/types';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);
const STORAGE_KEY = 'lume-view-mode';

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('technical');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'technical' || stored === 'business') {
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<ViewModeContextValue>(() => ({
    mode,
    setMode: setModeState,
    toggleMode: () => setModeState((current) => (current === 'technical' ? 'business' : 'technical')),
  }), [mode]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    return {
      mode: 'technical' as ViewMode,
      setMode: () => undefined,
      toggleMode: () => undefined,
    };
  }

  return context;
}
