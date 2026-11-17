import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir(".sites-runtime/tests", { recursive: true });
await build({
  entryPoints: ["tests/payroll.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".sites-runtime/tests/payroll.mjs",
});
const result = spawnSync(
  process.execPath,
  ["--test", ".sites-runtime/tests/payroll.mjs"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
