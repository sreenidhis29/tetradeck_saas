import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Continuum | Modern HR for Startups",
  description: "The AI-powered HR platform startups deserve. Leave management, attendance, and team organization in one beautiful platform. Free for your first year.",
  keywords: ["HR software", "leave management", "attendance tracking", "startup HR", "HRIS", "employee management"],
  openGraph: {
    title: "Continuum | Modern HR for Startups",
    description: "The AI-powered HR platform startups deserve. Free for your first year.",
    url: "https://continuum.hr",
    siteName: "Continuum",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Continuum | Modern HR for Startups",
    description: "The AI-powered HR platform startups deserve. Free for your first year."
  }
};



export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} antialiased bg-black text-white selection:bg-[#00f2ff] selection:text-black`}>
          {children}
          <Analytics />
          <SpeedInsights />
          <Toaster 
            theme="dark" 
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white'
              }
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}


