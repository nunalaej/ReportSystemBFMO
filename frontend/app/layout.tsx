import type { Metadata } from "next";
import {
  ClerkProvider,
  SignedIn,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import ThemeToggle from "./ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BFMO Report System",
  description: "Buildings and Facilities Maintenance Office",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider>
            <header className="layout">
              {/* LEFT SECTION */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo-dlsud.png"
                  alt="DLSU-D Logo"
                  className="w-10 h-10 object-contain"
                />
                <h1 className="text-base sm:text-lg font-semibold">
                  BFMO Report System
                </h1>
              </div>

              {/* RIGHT SECTION */}
              <div className="flex items-center gap-3">
                {/* Dark mode toggle */}
                <ThemeToggle />

                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </header>

            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
