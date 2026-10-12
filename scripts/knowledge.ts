import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (!((command === "import" && argument) || (command === "source" && argument) || command === "check")) {
    throw new Error("Usage: pnpm knowledge:import <manifest.json> | pnpm knowledge:source <official-url> | pnpm knowledge:check");
  }
  const { prisma } = await import("../lib/prisma");
  try {
    const { knowledgeIngestionService } = await import("../src/services/knowledge-ingestion.service");
    if (command === "import") {
      const raw = await readFile(argument, "utf8");
      if (Buffer.byteLength(raw) > 3 * 1024 * 1024) throw new Error("Manifest exceeds 3 MiB");
      console.log(JSON.stringify(await knowledgeIngestionService.importManifest(JSON.parse(raw)), null, 2));
    } else if (command === "source") {
      const { fetchKnowledgeSource } = await import("../lib/knowledge-source");
      console.log(JSON.stringify(await fetchKnowledgeSource(argument), null, 2));
    } else {
      const results = await knowledgeIngestionService.checkSources();
      console.log(JSON.stringify(results, null, 2));
      if (results.some((item) => item.status !== "UNCHANGED" || item.reviewOverdue)) process.exitCode = 1;
    }
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Knowledge operation failed");
  process.exitCode = 1;
});
