import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "src");
const tests = [];

async function discover(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (filename !== join(source, "db")) await discover(filename);
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      tests.push(relative(root, filename));
    }
  }
}

await discover(source);
tests.sort();
if (tests.length === 0) throw new Error("No unit tests found under src/");

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--test", ...process.argv.slice(2), ...tests],
  {
    cwd: root,
    env: { ...process.env, SKIP_ENV_VALIDATION: "1" },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
