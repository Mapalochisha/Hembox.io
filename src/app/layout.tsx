import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AgencyProvider } from "@/components/providers/agency-provider";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Hembox.io — Your website shouldn't be boring",
  description: "We build fast, beautiful sites that actually convert. No templates. No bloat. Just results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="selection:bg-coral/20 selection:text-navy">
        <AuthProvider>
          <AgencyProvider>
            {children}
            <Toaster />
          </AgencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
