export const STANDALONE_MONACO_THEMES = Object.freeze({
  light: Object.freeze({ name: 'ycoders-standalone-light', baseTheme: 'ycoders-light', editorBackground: '#ffffff', gutterBackground: '#f3f5f4' }),
  dark: Object.freeze({ name: 'ycoders-standalone-dark', baseTheme: 'ycoders-dark', editorBackground: '#171c19', gutterBackground: '#121714' }),
});

export function standaloneMonacoTheme(appearance) {
  return STANDALONE_MONACO_THEMES[appearance === 'dark' ? 'dark' : 'light'];
}

export function standaloneMonacoOptions(preferences) {
  if (!preferences) return {};
  return {
    folding: false,
    glyphMargin: false,
    lineNumbersMinChars: 2,
    lineDecorationsWidth: 26,
    minimap: { enabled: false },
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
    },
  };
}
