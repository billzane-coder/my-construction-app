import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation"; 

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
        {/* Global Top Navigation */}
        <Navigation /> 
        
        {/* The 'children' here will either be the Projects Dashboard 
            or the Sidebar Layout we built for specific projects */}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}