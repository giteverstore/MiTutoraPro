export function isV2CoursePilotEnabled(environment = import.meta.env) {
  const enabled = String(environment.VITE_V2_COURSE_PILOT_ENABLED ?? '').toLowerCase() === 'true';
  const deployment = String(environment.VITE_YCODERS_ENVIRONMENT ?? environment.MODE ?? '').toLowerCase();
  return enabled && (deployment === 'development' || deployment === 'preview' || deployment === 'staging' || deployment === 'test');
}
