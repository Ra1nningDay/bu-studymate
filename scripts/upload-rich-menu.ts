import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_DATA_API_BASE = "https://api-data.line.me/v2/bot";
const MAX_RICH_MENU_IMAGE_BYTES = 1_000_000;
const IMAGE_PATH = path.join(process.cwd(), "public", "rich-menu-v2.png");

type RichMenuArea = {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  action:
    | {
        type: "message";
        text: string;
      }
    | {
        type: "uri";
        uri: string;
      };
};

function loadDotEnvLocal() {
  return readFile(path.join(process.cwd(), ".env.local"), "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) continue;

        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        process.env[key] ??= value;
      }
    })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function lineFetch(pathname: string, init: RequestInit = {}) {
  const accessToken = requireEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch(`${LINE_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`LINE API failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function lineDataFetch(pathname: string, init: RequestInit = {}) {
  const accessToken = requireEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch(`${LINE_DATA_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`LINE data API failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function prepareRichMenuImage() {
  const source = sharp(IMAGE_PATH);
  const metadata = await source.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image size: ${IMAGE_PATH}`);
  }

  const optimized = await sharp(IMAGE_PATH)
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 90
    })
    .toBuffer();

  if (optimized.byteLength > MAX_RICH_MENU_IMAGE_BYTES) {
    throw new Error(
      `Optimized rich menu image is still too large: ${optimized.byteLength} bytes`
    );
  }

  return {
    contentType: "image/png",
    height: metadata.height,
    image: optimized,
    width: metadata.width
  };
}

function buildAreas(width: number, height: number): RichMenuArea[] {
  const topY = Math.round(height * 0.507);
  const bottomY = Math.round(height * 0.741);
  const buttonHeight = Math.round(height * 0.221);
  const leftX = Math.round(width * 0.016);
  const rightX = Math.round(width * 0.506);
  const buttonWidth = Math.round(width * 0.479);

  return [
    {
      bounds: { x: leftX, y: topY, width: buttonWidth, height: buttonHeight },
      action: { type: "message", text: "ถามข้อมูลทั่วไป" }
    },
    {
      bounds: { x: rightX, y: topY, width: buttonWidth, height: buttonHeight },
      action: { type: "uri", uri: "https://campus.bu.ac.th/" }
    },
    {
      bounds: { x: leftX, y: bottomY, width: buttonWidth, height: buttonHeight },
      action: { type: "message", text: "ดูบันทึกโน้ต" }
    },
    {
      bounds: { x: rightX, y: bottomY, width: buttonWidth, height: buttonHeight },
      action: { type: "message", text: "แจ้งปัญหาห้องเรียน" }
    }
  ];
}

async function createRichMenu(width: number, height: number) {
  const areas = buildAreas(width, height);
  const response = await lineFetch("/richmenu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      size: { width, height },
      selected: true,
      name: "BU StudyMate rich menu v2",
      chatBarText: "เมนู StudyMate",
      areas
    })
  });

  return (await response.json()) as { richMenuId: string };
}

async function uploadRichMenuImage(richMenuId: string, image: Buffer, contentType: string) {
  await lineDataFetch(`/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": contentType
    },
    body: new Blob([new Uint8Array(image)], { type: contentType })
  });
}

async function setDefaultRichMenu(richMenuId: string) {
  await lineFetch(`/user/all/richmenu/${richMenuId}`, {
    method: "POST"
  });
}

async function deleteRichMenu(richMenuId: string) {
  await lineFetch(`/richmenu/${richMenuId}`, {
    method: "DELETE"
  });
}

async function main() {
  await loadDotEnvLocal();
  const { contentType, height, image, width } = await prepareRichMenuImage();
  const { richMenuId } = await createRichMenu(width, height);

  try {
    await uploadRichMenuImage(richMenuId, image, contentType);
    await setDefaultRichMenu(richMenuId);
  } catch (error) {
    await deleteRichMenu(richMenuId).catch(() => undefined);
    throw error;
  }

  console.log(`Uploaded and set default rich menu: ${richMenuId}`);
  console.log(`Source image: ${path.relative(process.cwd(), IMAGE_PATH)} (${width}x${height})`);
  console.log(`Uploaded image bytes: ${image.byteLength}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
