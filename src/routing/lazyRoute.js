import { lazy } from 'react';

export function lazyNamedExport(loader, exportName) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}
