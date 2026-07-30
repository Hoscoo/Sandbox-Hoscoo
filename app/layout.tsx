import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoscoo",
  description: "Unified payment orchestration across MNO, bank, gateway, and cross-border rails.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
