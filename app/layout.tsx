import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WishlistProvider } from "@/components/kartly/wishlist";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Kartly - AI Shopping Assistant",
  description:
    "I search Amazon, Flipkart, Blinkit, Zepto and more, verify seller trustworthiness, and pick the safest best deal.",
  applicationName: "Kartly",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kartly",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Kartly",
    title: "Kartly - AI Shopping Assistant",
    description:
      "Smart shopping buddy for India: compare prices across Amazon, Flipkart, Blinkit, verify sellers, and spot fraud.",
  },
  twitter: {
    card: "summary",
    title: "Kartly - AI Shopping Assistant",
    description:
      "Smart shopping buddy for India: compare prices, verify sellers, and spot fraud.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${geistSans.className} font-sans min-h-full flex flex-col`}>
        <WishlistProvider>{children}</WishlistProvider>
      </body>
    </html>
  );
}
