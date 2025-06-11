import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "String Asset Translator",
  description: "Translate your app's string assets using Google Gemini AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
