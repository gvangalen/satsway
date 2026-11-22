import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Satsway",
  description: "Een premium betaalverzoek app voor euro en bitcoin",
  applicationName: "Satsway",
  icons: { icon: "/satsway-icon.svg", apple: "/satsway-icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Satsway" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
