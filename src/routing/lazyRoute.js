import { lazy } from 'react';
import { phase5Mark } from '../performance/phase5Mark.js';

export function lazyNamedExport(loader, exportName) {
  return lazy(async () => {
    phase5Mark(`lazy:${exportName}:start`);
    const module = await loader();
    phase5Mark(`lazy:${exportName}:end`);
    return { default: module[exportName] };
  });
}
