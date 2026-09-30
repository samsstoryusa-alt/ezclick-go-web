import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
export const metadata: Metadata = {
 title: "EZCLICK GO — Your truck. Your business. Your rules.",
 description: "Loads, profit, routes, weather, fuel and AI dispatch. Your trucking business, connected.",
 icons: { icon: "/favicon.svg" },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><head><link rel="preload" as="font" href="/fonts/brand-4.ttf" type="font/ttf" crossOrigin="anonymous" /><link rel="preload" as="font" href="/fonts/brand-0.ttf" type="font/ttf" crossOrigin="anonymous" /><link rel="preload" as="image" href="/media/journey/00-smooth/0001.webp" /></head><body>{children}</body></html>;
}
