import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const cliPath = path.resolve(projectRoot, "node_modules", "@react-router", "dev", "bin.cjs");
const caPath = path.resolve(projectRoot, "certs", "russian_trusted_root_ca_pem.crt");

if (!existsSync(cliPath)) {
  console.error("React Router CLI is missing. Run npm install first.");
  process.exit(1);
}

const environment = { ...process.env };
if (!environment.NODE_EXTRA_CA_CERTS && existsSync(caPath)) {
  environment.NODE_EXTRA_CA_CERTS = caPath;
}

const child = spawn(
  process.execPath,
  [
    "--env-file-if-exists=.env.ai.local",
    cliPath,
    "dev",
    ...process.argv.slice(2),
  ],
  {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Could not start React Router dev server: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
