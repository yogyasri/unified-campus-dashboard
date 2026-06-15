import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";

export const metadata: Metadata = {
  title: "Campus Hub — Unified Campus Dashboard",
  description: "AI-powered campus dashboard connecting library, cafeteria, events, academics, and more through intelligent MCP servers.",
  keywords: ["campus", "dashboard", "AI assistant", "university", "MCP"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full">
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
