import { normalizePath, type Plugin } from 'vite';

/**
 * @tailwindcss/vite reports every scanned source file through addWatchFile using native
 * Windows paths (D:\...). Vite then fails to match them against the project root and
 * registers those modules as /@fs/D:\... URLs, so an HMR update loads a second copy of
 * the module beside the /src/ one. Duplicated React contexts then throw errors such as
 * "requires UnsavedChangesProvider" until the dev server restarts.
 */
export function normalizeWatchFiles(plugins: Plugin[]): Plugin[] {
  return plugins.map((plugin) => {
    const { transform } = plugin;
    if (typeof transform !== 'function') return plugin;
    return {
      ...plugin,
      transform(...args) {
        const context = new Proxy(this, {
          get(target, key) {
            if (key === 'addWatchFile') return (file: string) => target.addWatchFile(normalizePath(file));
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return transform.apply(context, args);
      },
    };
  });
}
