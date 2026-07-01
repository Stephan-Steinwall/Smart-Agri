// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DashboardLayout from "@/components/DashboardLayout";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Agriculture Platform",
  description: "AI-Integrated IoT-Based Soil Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </Providers>
      </body>
    </html>
  );
}

