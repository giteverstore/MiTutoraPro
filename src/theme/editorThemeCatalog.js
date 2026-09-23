export const DEFAULT_EDITOR_THEME_ID = 'ycoders-dark';

export const EDITOR_THEME_CATALOG = Object.freeze([
  { id: 'ycoders-dark', name: 'Y Coders Dark', monacoTheme: 'ycoders-dark', preview: ['#171c19', '#202722', '#60a5fa'], palette: { background: '#171c19', surface: '#202722', panel: '#171c19', text: '#e4ebe7', muted: '#a7b0aa', border: '#3f4b44', divider: '#46534b', controlBorder: '#536159', accent: '#60a5fa', focus: '#60a5fa' }, syntax: { comment: '78837C', keyword: 'B3CBBB', string: 'C2B4A4', number: 'D6B887', type: '79B8FF', function: 'B392F0', variable: 'E4EBE7', operator: 'F5F5F5' }, dark: true },
  { id: 'ycoders-light', name: 'Y Coders Light', monacoTheme: 'ycoders-light', preview: ['#ffffff', '#f8fafc', '#2563eb'], palette: { background: '#ffffff', surface: '#f8fafc', panel: '#ffffff', text: '#111827', muted: '#6b7280', border: '#d1d5db', divider: '#c7cdd6', controlBorder: '#b9c1cc', accent: '#2563eb', focus: '#2563eb' }, syntax: { comment: '6B7280', keyword: '7C3AED', string: '047857', number: 'B45309', type: '0369A1', function: '1D4ED8', variable: '111827', operator: '374151' }, dark: false },
  { id: 'amoled', name: 'AMOLED', monacoTheme: 'ycoders-amoled', preview: ['#000000', '#080808', '#22d3ee'], palette: { background: '#000000', surface: '#050505', panel: '#080808', text: '#f5f5f5', muted: '#a3a3a3', border: '#2d2d2d', divider: '#383838', controlBorder: '#454545', accent: '#22d3ee', focus: '#22d3ee' }, syntax: { comment: '8B949E', keyword: 'FF7B72', string: 'A5D6FF', number: '79C0FF', type: 'D2A8FF', function: '7EE787', variable: 'F5F5F5', operator: 'FFA657' }, dark: true },
  { id: 'cream', name: 'Cream', monacoTheme: 'ycoders-cream', preview: ['#fff9ec', '#f6eedc', '#9a5b13'], palette: { background: '#fff9ec', surface: '#f6eedc', panel: '#fbf2de', text: '#2b2419', muted: '#756a59', border: '#d8cdb7', divider: '#c9bda5', controlBorder: '#b9aa8e', accent: '#9a5b13', focus: '#9a5b13' }, syntax: { comment: '756A59', keyword: '7C3F00', string: '476B2A', number: '9A3412', type: '0F5F6D', function: '6B4E9B', variable: '2B2419', operator: '664C2A' }, dark: false },
  { id: 'github-dark', name: 'GitHub Dark', monacoTheme: 'ycoders-github-dark', preview: ['#0d1117', '#161b22', '#58a6ff'], palette: { background: '#0d1117', surface: '#161b22', panel: '#0d1117', text: '#c9d1d9', muted: '#8b949e', border: '#30363d', divider: '#3d444d', controlBorder: '#484f58', accent: '#58a6ff', focus: '#58a6ff' }, syntax: { comment: '8B949E', keyword: 'FF7B72', string: 'A5D6FF', number: '79C0FF', type: 'FFA657', function: 'D2A8FF', variable: 'C9D1D9', operator: 'FF7B72' }, dark: true },
  { id: 'github-light', name: 'GitHub Light', monacoTheme: 'ycoders-github-light', preview: ['#ffffff', '#f6f8fa', '#0969da'], palette: { background: '#ffffff', surface: '#f6f8fa', panel: '#ffffff', text: '#1f2328', muted: '#656d76', border: '#d0d7de', divider: '#afb8c1', controlBorder: '#8c959f', accent: '#0969da', focus: '#0969da' }, syntax: { comment: '6E7781', keyword: 'CF222E', string: '0A3069', number: '0550AE', type: '953800', function: '8250DF', variable: '24292F', operator: 'CF222E' }, dark: false },
]);

const aliases = Object.freeze({ 'mitutora-dark': 'ycoders-dark', 'vs-dark': 'ycoders-dark', light: 'ycoders-light' });
const byId = new Map(EDITOR_THEME_CATALOG.map((theme) => [theme.id, theme]));

export function normalizeEditorThemeId(value) {
  const normalized = aliases[value] ?? value;
  return byId.has(normalized) ? normalized : DEFAULT_EDITOR_THEME_ID;
}

export function editorThemeById(value) {
  return byId.get(normalizeEditorThemeId(value));
}
