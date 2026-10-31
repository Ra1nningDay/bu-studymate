import type { AnswerSource } from "./types";

const officialBuHostnames = [
  "admission.bu.ac.th",
  "bu.ac.th",
  "bulinks.bu.ac.th",
  "contents.bu.ac.th",
  "faq.bu.ac.th",
  "library.bu.ac.th",
  "www.bu.ac.th"
];

export function isOfficialBuSource(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return officialBuHostnames.some((officialHost) => {
      return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
    });
  } catch {
    return false;
  }
}

function isSpecificOfficialBuSource(url: string) {
  if (!isOfficialBuSource(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.replace(/\/+$/g, "").toLowerCase();

    // If it's a generic hostname, require a specific path (reject /, /th, /en)
    if (hostname === "bu.ac.th" || hostname === "www.bu.ac.th") {
      return Boolean(path && !["/en", "/th"].includes(path));
    }

    // For specific subdomains like admission.bu.ac.th, the root page itself is acceptable
    return true;
  } catch {
    return false;
  }
}

export function uniqueSources(sources: AnswerSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const url = source.url.replace(/[),.]+$/g, "");
    if (!url || url.includes("](") || seen.has(url)) {
      return false;
    }

    source.url = url;
    source.title = source.title.replace(/[,.]+$/g, "");
    seen.add(url);
    return true;
  });
}

async function fetchSource(url: string, method: "GET" | "HEAD") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isReachableSource(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return false;
  }

  try {
    const headResponse = await fetchSource(parsedUrl.toString(), "HEAD");
    if (headResponse.ok) {
      return true;
    }

    if (![403, 405].includes(headResponse.status)) {
      return false;
    }
  } catch {
    // Some sites block HEAD. Fall through to a small GET verification.
  }

  try {
    const getResponse = await fetchSource(parsedUrl.toString(), "GET");
    return getResponse.ok;
  } catch {
    return false;
  }
}

export async function verifyAnswerSources(sources: AnswerSource[]) {
  const unique = uniqueSources(
    sources.map((source) => ({
      title: source.title.trim() || source.url,
      url: source.url.trim()
    }))
  );

  const verified = await Promise.all(
    unique.map(async (source) => ((await isReachableSource(source.url)) ? source : null))
  );

  return verified.filter((source): source is AnswerSource => Boolean(source));
}

export async function verifyOfficialBuSources(sources: AnswerSource[]) {
  const officialSources = sources.filter((source) => isOfficialBuSource(source.url));
  return verifyAnswerSources(officialSources);
}

export async function verifyFreshInfoSources(sources: AnswerSource[]) {
  const specificOfficialSources = sources.filter((source) =>
    isSpecificOfficialBuSource(source.url)
  );
  return verifyAnswerSources(specificOfficialSources);
}
