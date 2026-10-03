import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kibibyte = 1024;
const limits = {
  largestJavaScript: 800 * kibibyte,
  totalJavaScript: 4800 * kibibyte,
  // Includes the self-hosted Noto Sans TC Unicode-range font declarations.
  totalCss: 340 * kibibyte,
  largestGlb: 1800 * kibibyte,
  // Includes both editor assets and the lazy-loaded Quaternius avatar kit.
  totalGlb: 11000 * kibibyte,
};

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function formatKibibytes(bytes) {
  return `${(bytes / kibibyte).toFixed(1)} KiB`;
}

export function checkBundleBudget(distDirectory = join(process.cwd(), 'dist')) {
  const files = collectFiles(distDirectory);
  const javascript = files.filter((file) => extname(file) === '.js');
  const css = files.filter((file) => extname(file) === '.css');
  const glb = files.filter((file) => extname(file) === '.glb');

  if (javascript.length === 0) {
    throw new Error('Bundle budget check found no JavaScript assets. Run `npm run build` first.');
  }

  const largestJavaScript = javascript.reduce((largest, file) => (
    statSync(file).size > statSync(largest).size ? file : largest
  ));
  const largestJavaScriptBytes = statSync(largestJavaScript).size;
  const totalJavaScriptBytes = javascript.reduce((sum, file) => sum + statSync(file).size, 0);
  const totalCssBytes = css.reduce((sum, file) => sum + statSync(file).size, 0);
  const largestGlbBytes = glb.reduce((largest, file) => Math.max(largest, statSync(file).size), 0);
  const totalGlbBytes = glb.reduce((sum, file) => sum + statSync(file).size, 0);

  const measurements = [
    {
      label: `largest JavaScript chunk (${relative(process.cwd(), largestJavaScript)})`,
      actual: largestJavaScriptBytes,
      limit: limits.largestJavaScript,
    },
    { label: 'total JavaScript', actual: totalJavaScriptBytes, limit: limits.totalJavaScript },
    { label: 'total CSS', actual: totalCssBytes, limit: limits.totalCss },
    { label: 'largest GLB asset', actual: largestGlbBytes, limit: limits.largestGlb },
    { label: 'total GLB assets', actual: totalGlbBytes, limit: limits.totalGlb },
  ];

  return { passed: measurements.every(({ actual, limit }) => actual <= limit), measurements };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Use check-bundle-budget.mjs [BUILT_DIST]');
  const { passed, measurements } = checkBundleBudget(process.argv[2] ? resolve(process.argv[2]) : undefined);
  for (const measurement of measurements) {
    const passed = measurement.actual <= measurement.limit;
    console.log(
      `${passed ? 'PASS' : 'FAIL'} ${measurement.label}: ${formatKibibytes(measurement.actual)} / ${formatKibibytes(measurement.limit)}`,
    );
  }

  if (!passed) {
    process.exitCode = 1;
  }
}
