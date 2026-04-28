import { APP_DESCRIPTION, APP_NAME } from "@/core/constants";
import { AppProviders } from "@/core/providers/app-providers";
import "@rainbow-me/rainbowkit/styles.css";
import "@repo/ui/globals.css";
import { AppShell } from "@/features/common";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import type { Metadata } from "next";

import "./globals.css";

const sansFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: `${APP_NAME} | Web3 Freelancing on Stellar`,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sansFont.variable} ${monoFont.variable}`}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
