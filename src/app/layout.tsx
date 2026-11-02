import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKY-PORTAL | ドローン業務管理",
  description: "業務用ドローン 業務管理システム",
  applicationName: "SKY-PORTAL",
  appleWebApp: { capable: true, title: "SKY-PORTAL", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-slate-100 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
