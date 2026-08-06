import type { Metadata, Viewport } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "BITTR CO. — Revisão de lacunas",
  description:
    "Ferramenta mobile para avaliar informações, identificar dados cruciais ausentes e validar a montagem lógica.",
  applicationName: "BITTR CO.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BITTR CO.",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f7a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${syne.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
