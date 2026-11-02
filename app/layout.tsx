import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WDESK CONTROL CENTER",
  description: "Centre de contrôle des infrastructures WDESK",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}