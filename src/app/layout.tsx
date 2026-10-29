import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AgencyProvider } from "@/components/providers/agency-provider";

// Supabase is used by the client-side auth provider. Keep the application
// request-driven so Next.js does not execute that client provider while
// statically prerendering pages during a Vercel build.
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Hembox Tech — Build Beyond Boundaries",
  description: "Hembox Tech builds beyond boundaries with branding, websites, applications, and digital solutions that help businesses move forward.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
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
