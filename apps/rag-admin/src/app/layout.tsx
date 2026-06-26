import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoleCraft RAG Admin — Pipeline Monitor",
  description: "Internal monitoring dashboard for the MoleCraft RAG retrieval pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
