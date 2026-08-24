export const BUNDLE_BUDGETS = Object.freeze({
  initialJavaScriptBytes: 1_000_000,
  initialJavaScriptGzipBytes: 260_000,
  initialCssBytes: 250_000,
  initialCssGzipBytes: 40_000,
});

export const REQUIRED_LAZY_ROUTES = Object.freeze([
  'src/components/auth/AuthFlow.jsx',
  'src/pages/HomePage.jsx',
  'src/pages/PracticePage.jsx',
  'src/pages/ChallengesPage.jsx',
  'src/pages/BookmarksPage.jsx',
  'src/pages/CertificatesPage.jsx',
  'src/pages/ReferralsPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/ProjectsPage.jsx',
  'src/exam/pages/ExamExperience.jsx',
  'src/exam/pages/SetupVerificationExperience.jsx',
  'src/routing/CourseRoute.jsx',
]);

const HEAVY_FEATURE_ENTRIES = Object.freeze([
  'src/components/MonacoCodeEditor.jsx',
  'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
  'src/exam/services/SileroVadRuntime.js',
]);

function staticClosure(manifest, entryKey) {
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    for (const dependency of manifest[key]?.imports ?? []) visit(dependency);
  };
  visit(entryKey);
  return visited;
}

export function evaluateBundleBudget(manifest, readAsset, budgets = BUNDLE_BUDGETS) {
  const failures = [];
  const entry = Object.entries(manifest).find(([, value]) => value.isEntry);
  if (!entry) return { failures: ['Build manifest has no application entry.'], measurements: null };

  const [entryKey] = entry;
  const initialEntries = staticClosure(manifest, entryKey);
  const initialJsFiles = [...initialEntries]
    .map((key) => manifest[key]?.file)
    .filter((file) => file?.endsWith('.js'));
  const initialCssFiles = [...new Set([...initialEntries].flatMap((key) => manifest[key]?.css ?? []))];

  const summarize = (files) => files.reduce((total, file) => {
    const asset = readAsset(file);
    return {
      bytes: total.bytes + asset.bytes,
      gzipBytes: total.gzipBytes + asset.gzipBytes,
    };
  }, { bytes: 0, gzipBytes: 0 });

  const js = summarize(initialJsFiles);
  const css = summarize(initialCssFiles);
  if (js.bytes > budgets.initialJavaScriptBytes) {
    failures.push(`Initial JavaScript is ${js.bytes} bytes; budget is ${budgets.initialJavaScriptBytes}.`);
  }
  if (js.gzipBytes > budgets.initialJavaScriptGzipBytes) {
    failures.push(`Initial JavaScript gzip is ${js.gzipBytes} bytes; budget is ${budgets.initialJavaScriptGzipBytes}.`);
  }
  if (css.bytes > budgets.initialCssBytes) {
    failures.push(`Initial CSS is ${css.bytes} bytes; budget is ${budgets.initialCssBytes}.`);
  }
  if (css.gzipBytes > budgets.initialCssGzipBytes) {
    failures.push(`Initial CSS gzip is ${css.gzipBytes} bytes; budget is ${budgets.initialCssGzipBytes}.`);
  }

  for (const route of REQUIRED_LAZY_ROUTES) {
    if (!manifest[route]?.isDynamicEntry) failures.push(`${route} is not a dynamic route entry.`);
    if (initialEntries.has(route)) failures.push(`${route} is part of the initial static graph.`);
  }
  for (const feature of HEAVY_FEATURE_ENTRIES) {
    if (!manifest[feature]?.isDynamicEntry) failures.push(`${feature} is not lazy loaded.`);
    if (initialEntries.has(feature)) failures.push(`${feature} is part of the initial static graph.`);
  }

  return {
    failures,
    measurements: {
      entryKey,
      initialJsFiles,
      initialCssFiles,
      initialJavaScriptBytes: js.bytes,
      initialJavaScriptGzipBytes: js.gzipBytes,
      initialCssBytes: css.bytes,
      initialCssGzipBytes: css.gzipBytes,
    },
  };
}
