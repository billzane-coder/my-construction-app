import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. Matches your lowercase file name exactly: "topnav.tsx"
import TopNav from "@/app/components/topnav"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SiteMaster QA",
  description: "Construction Quality Assurance Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-950">
      <body className={`${inter.className} antialiased text-slate-100`}>
        
        {/* 2. React components must be Capitalized in the UI */}
        <TopNav /> 
        
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}