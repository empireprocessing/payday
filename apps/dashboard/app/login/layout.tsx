import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
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
  title: "PAYDAY - Connexion",
  description: "Connexion au dashboard PAYDAY",
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

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pas de vérification d'authentification pour la page de login
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
