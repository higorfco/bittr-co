import type { Metadata, Viewport } from "next";
import { Cinzel, Literata } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BITTR CO. — PANDA93",
  description:
    "Avaliação PANDA93 da anamnese: escores e lacunas clínicas, com anonimização LGPD.",
  applicationName: "BITTR CO.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BITTR CO.",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${cinzel.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
