/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mammoth", "pdf-parse", "@napi-rs/canvas", "tesseract.js"]
};

export default nextConfig;
