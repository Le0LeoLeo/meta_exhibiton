import { availableParallelism } from 'node:os';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const defaultConcurrency = Math.min(4, availableParallelism());

function runNodeCheck(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', file], {
      stdio: 'pipe',
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ status: 1, stdout, stderr: error.message }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

export async function checkFiles(
  files,
  { concurrency = defaultConcurrency, runCheck = runNodeCheck } = {},
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer');
  }

  const failures = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const file = files[nextIndex];
      nextIndex += 1;
      const result = await runCheck(file);

      if (result.status !== 0) {
        failures.push({ file, stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
      }
    }
  }

  const workerCount = Math.min(concurrency, files.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  failures.sort((left, right) => left.file.localeCompare(right.file));

  return { exitCode: failures.length > 0 ? 1 : 0, failures };
}

function collectJsFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      collectJsFiles(fullPath, files);
      continue;
    }

    if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const serverDir = join(process.cwd(), 'server');
  const files = collectJsFiles(serverDir);
  const { exitCode, failures } = await checkFiles(files);

  for (const failure of failures) {
    console.error(`\nSyntax check failed: ${relative(process.cwd(), failure.file)}`);
    if (failure.stderr) console.error(failure.stderr.trim());
    if (failure.stdout) console.error(failure.stdout.trim());
  }

  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  console.log(`Checked ${files.length} server JavaScript files.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
