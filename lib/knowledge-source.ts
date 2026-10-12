import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";

export function isPublicKnowledgeAddress(address: string) {
  if (isIP(address) === 6) {
    return /^[23]/i.test(address) && !/^2001:db8:/i.test(address);
  }
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224 &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) &&
    !(a === 198 && [18, 19, 51].includes(b)) && !(a === 203 && b === 0);
}

function requestSnapshot(url: URL, address: string, signal: AbortSignal) {
  return new Promise<{ status: number; location?: string; body: Buffer }>((resolve, reject) => {
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      signal, autoSelectFamily: false,
      headers: { "User-Agent": "BU-StudyMate-Knowledge/1.0", "Accept-Encoding": "identity" },
      // Pin the validated address while retaining hostname/TLS certificate checks.
      lookup: (_hostname, _options, callback) => callback(null, address, isIP(address))
    };
    const req = request(url, options, (response) => {
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 2 * 1024 * 1024) req.destroy(new Error("Knowledge source exceeds 2 MiB"));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode ?? 0,
        location: response.headers.location, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function fetchKnowledgeSource(sourceUrl: string, dependencies = {
  lookup: (hostname: string) => lookup(hostname, { all: true }),
  request: requestSnapshot
}) {
  const signal = AbortSignal.timeout(8000);
  let current = sourceUrl;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const url = new URL(officialKnowledgeUrlSchema.parse(current));
    const addresses = await Promise.race([
      dependencies.lookup(url.hostname),
      new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
    ]);
    signal.throwIfAborted();
    if (!addresses.length || addresses.some((entry) => !isPublicKnowledgeAddress(entry.address))) {
      throw new Error("Knowledge source resolves to an unsafe address");
    }
    const response = await dependencies.request(url, addresses[0].address, signal);
    if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
      current = new URL(response.location, url).toString();
      continue;
    }
    if (response.status !== 200 || !response.body.length) throw new Error(`Knowledge source unavailable (${response.status})`);
    return { sourceHash: createHash("sha256").update(response.body).digest("hex"), finalUrl: url.toString() };
  }
  throw new Error("Knowledge source exceeds three redirects");
}
