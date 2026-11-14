import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "./register-sw";
export const metadata: Metadata = {
  title: "Marsline | Mission Intelligence",
  description: "Integrated Mars surface mission planning, NASA science data and Firebase-backed workspace.",
  applicationName: "Marsline",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#101318", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RegisterSW />{children}</body></html>;
}
