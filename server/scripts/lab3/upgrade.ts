import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(packageCli: string, args: string[]) {
  const script = resolve(process.cwd(), "node_modules", packageCli);
  const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

await run("prisma/build/index.js", ["migrate", "deploy"]);
await run("tsx/dist/cli.mjs", ["scripts/lab3/backfill-credentials.ts"]);
await run("tsx/dist/cli.mjs", ["scripts/lab3/verify-migration.ts"]);
await run("tsx/dist/cli.mjs", ["scripts/lab3/finalize-constraints.ts"]);
await run("tsx/dist/cli.mjs", ["prisma/seed.ts"]);
