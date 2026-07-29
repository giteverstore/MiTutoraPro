import { createContext, useContext, useEffect } from 'react';

const CompilerContext = createContext(null);

export function CompilerProvider({ manager, children }) {
  useEffect(() => () => {
    void manager?.dispose();
  }, [manager]);

  if (!manager) {
    throw new Error('CompilerProvider requires a CompilerManager instance.');
  }

  return (
    <CompilerContext.Provider value={manager}>
      {children}
    </CompilerContext.Provider>
  );
}

export function useCompilerManager() {
  const manager = useContext(CompilerContext);

  if (!manager) {
    throw new Error('useCompilerManager must be used inside CompilerProvider.');
  }

  return manager;
}
