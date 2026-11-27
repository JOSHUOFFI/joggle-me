import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

export const metadata: Metadata = {
  title: { default: "JOGGLE ME", template: "%s | JOGGLE ME" },
  metadataBase,
  applicationName: "JOGGLE ME",
  description: "Learn. Challenge Yourself. Level Up. Learn, assess, and improve with JOGGLE ME.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="joggle-theme-preference" strategy="beforeInteractive">
          {`try { var t = localStorage.getItem("joggle-theme"); if (t === "dark" || t === "light") { document.documentElement.classList.add(t); document.documentElement.style.colorScheme = t; } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) { document.documentElement.classList.add("dark"); document.documentElement.style.colorScheme = "dark"; } } catch {}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
