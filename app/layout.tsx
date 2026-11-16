import type { Metadata } from "next";
import { Anton, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Anton({ variable: "--ff-display", weight: "400", subsets: ["latin"] });
const sans = Inter({ variable: "--ff-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--ff-mono", weight: ["500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Silicon Showdown",
  description: "A satirical fighting game set in a Senate hearing. Every line is something they really said.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
