import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Kintai" },
  applicationName: "Kintai",
  description: "Attendance and leave, stored on this phone.",
  manifest: "/me.webmanifest",
  appleWebApp: { capable: true, title: "Kintai", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e7e1d4",
};

export default function MeLayout({ children }: { children: ReactNode }) {
  return children;
}
