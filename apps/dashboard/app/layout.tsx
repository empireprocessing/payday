import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PAYDAY - Dashboard de paiement",
  description: "Plateforme de gestion des paiements et des boutiques en ligne. Gérez vos transactions, configurez vos PSP et analysez vos performances commerciales.",
  robots: {
    index: false,
    follow: false,
    nosnippet: true,
    noarchive: true,
    nocache: true,
    noimageindex: true,
    nositelinkssearchbox: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nocache: true,
      noarchive: true,
      nosnippet: true,
      nositelinkssearchbox: true,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
