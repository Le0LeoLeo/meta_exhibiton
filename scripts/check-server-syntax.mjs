import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const serverDir = join(process.cwd(), 'server');
const files = [];

function collectJsFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      collectJsFiles(fullPath);
      continue;
    }

    if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

collectJsFiles(serverDir);

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`\nSyntax check failed: ${relative(process.cwd(), file)}`);
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} server JavaScript files.`);
