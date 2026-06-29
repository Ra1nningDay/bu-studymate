import { spawn } from "node:child_process";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: tsx scripts/prisma.ts <prisma args...>");
  process.exit(1);
}

const command = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);

const rawEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NODE_ENV: process.env.NODE_ENV,
  PATH: process.env.PATH,
  Path: process.env.Path,
  PATHEXT: process.env.PATHEXT,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  PRISMA_HIDE_UPDATE_MESSAGE: "1"
};

const env = Object.fromEntries(
  Object.entries(rawEnv).filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string";
  })
) as NodeJS.ProcessEnv;

const child = spawn(command, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32"
});

child.on("exit", (code: number | null) => {
  process.exit(code ?? 1);
});
