import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { temaPreferito } from "@/lib/tema-preferito";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coaching Planner",
  description: "Gestionale per la consuntivazione mensile di collaboratori, clienti e offerte",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tema = await temaPreferito();

  return (
    <html
      lang="it"
      data-tema={tema}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
