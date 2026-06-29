/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mammoth", "pdf-parse", "tesseract.js"]
};

export default nextConfig;
