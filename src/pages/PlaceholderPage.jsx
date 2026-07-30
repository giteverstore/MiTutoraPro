import { APP_NAVIGATION } from '../app-shell/navigation';

export function PlaceholderPage({ page }) {
  const label = APP_NAVIGATION.find((item) => item.id === page)?.label ?? 'Page';
  return (
    <div className="placeholder-page">
      <span>MiTutora</span>
      <h1>{label}</h1>
      <p>This workspace is part of the application structure and is ready for future implementation.</p>
    </div>
  );
}

export function createPlaceholderPage(page) {
  return function ApplicationPlaceholderPage() {
    return <PlaceholderPage page={page} />;
  };
}
