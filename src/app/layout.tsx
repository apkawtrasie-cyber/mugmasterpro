import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MugMaster Pro",
  description: "Photoreal mug mockup studio powered by PixiJS WebGL.",
  manifest: "/manifest.json",
  applicationName: "MugMaster Pro",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MugMaster Pro" },
};

export const viewport: Viewport = {
  themeColor: "#0c0f12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
