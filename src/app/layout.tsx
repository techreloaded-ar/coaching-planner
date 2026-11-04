import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { temaPreferito } from "@/lib/tema-preferito";
import { ambientePreproduzione } from "@/lib/ambiente";
import { BannerPreproduzione } from "@/components/banner-preproduzione";
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
  const preproduzione = ambientePreproduzione();

  return (
    <html
      lang="it"
      data-tema={tema}
      data-ambiente={preproduzione ? "pre-prod" : undefined}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {preproduzione && <BannerPreproduzione />}
        {children}
      </body>
    </html>
  );
}
