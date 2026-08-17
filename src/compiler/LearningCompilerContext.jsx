import { createContext, useContext } from 'react';

const LearningCompilerContext = createContext(null);

export function LearningCompilerProvider({ controller, children }) {
  return (
    <LearningCompilerContext.Provider value={controller}>
      {children}
    </LearningCompilerContext.Provider>
  );
}

export function useOptionalLearningCompiler() {
  return useContext(LearningCompilerContext);
}
