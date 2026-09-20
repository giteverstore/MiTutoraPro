export const BRAND_THEME_CATALOG = Object.freeze([
  { id: 'blue', name: 'Y Coders Blue', price: 0, preview: { light: ['#2563eb', '#dbeafe', '#1d4ed8'], dark: ['#60a5fa', '#172554', '#93c5fd'] } },
  { id: 'ember', name: 'Ember', price: 500, preview: { light: ['#c45a12', '#fbe8d9', '#a9480c'], dark: ['#f59e42', '#3a2518', '#ffad5c'] } },
  { id: 'violet', name: 'Violet', price: 500, preview: { light: ['#7c3aed', '#ede9fe', '#6d28d9'], dark: ['#a78bfa', '#2e1065', '#c4b5fd'] } },
  { id: 'crimson', name: 'Crimson', price: 500, preview: { light: ['#be123c', '#ffe4e6', '#9f1239'], dark: ['#fb7185', '#4c0519', '#fda4af'] } },
  { id: 'cyber', name: 'Cyber', price: 500, preview: { light: ['#0f766e', '#ccfbf1', '#115e59'], dark: ['#2dd4bf', '#134e4a', '#5eead4'] } },
]);

export const brandThemeById = (id) => BRAND_THEME_CATALOG.find((theme) => theme.id === id) ?? BRAND_THEME_CATALOG[0];
export const ownedThemeIdsFromRedemptions = (redemptions = []) => new Set(['blue', ...redemptions.filter((item) => item.type === 'BRAND_THEME' && item.status === 'OWNED').map((item) => item.themeId)]);
