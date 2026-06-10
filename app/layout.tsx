import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Space Muse",
  description: "Space Muse room redesign with Gemini AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} min-h-screen lg:h-screen lg:overflow-hidden antialiased`}
    >
      <body className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#121214] text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
