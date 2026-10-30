import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BU StudyMate",
  description: "LINE chatbot for Bangkok University students"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
