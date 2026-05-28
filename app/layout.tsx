import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memory Jar",
  description: "A private map of the memories you want to keep close.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
