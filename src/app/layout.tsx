import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "X-Link Chat | Quantum ID Messenger",
  description: "Sci-fi inspired global chat where you connect via a single quantum ID.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        <div className="relative min-h-screen overflow-hidden">
          {/* Ambient background orbs */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="orb orb--cyan float-slow -left-32 top-10 h-72 w-72" />
            <div className="orb orb--violet pulse-soft right-[-120px] top-40 h-80 w-80" />
            <div className="orb orb--pink float-slow bottom-[-120px] left-1/2 h-64 w-64" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,253,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(45,212,191,0.16),transparent_55%)]" />
          </div>

          {/* Subtle grid overlay */}
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(to_right,rgba(15,23,42,0.8)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.8)_1px,transparent_1px)],[background-size:80px_80px]" />

          {children}
        </div>
      </body
>
    </html>
  );
}
