import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runner = process.platform === "win32" ? "npx.cmd" : "npx";

async function run(command: string, args: string[]) {
  await execFileAsync(command, args, { cwd: process.cwd(), env: process.env, windowsHide: true });
}

await run(runner, ["prisma", "migrate", "deploy"]);
await run(runner, ["tsx", "scripts/lab3/backfill-credentials.ts"]);
await run(runner, ["tsx", "scripts/lab3/verify-migration.ts"]);
await run(runner, ["tsx", "scripts/lab3/finalize-constraints.ts"]);
await run(runner, ["tsx", "prisma/seed.ts"]);
