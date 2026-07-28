import { createContext, useContext } from 'react';

const CompilerContext = createContext(null);

export function CompilerProvider({ adapter, children }) {
  if (!adapter) {
    throw new Error('CompilerProvider requires a CompilerAdapter instance.');
  }

  return (
    <CompilerContext.Provider value={adapter}>
      {children}
    </CompilerContext.Provider>
  );
}

export function useCompilerAdapter() {
  const adapter = useContext(CompilerContext);

  if (!adapter) {
    throw new Error('useCompilerAdapter must be used inside CompilerProvider.');
  }

  return adapter;
}

