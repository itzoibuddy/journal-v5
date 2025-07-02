import './lib/disableConsoleInProd';
import type { Metadata } from "next";
import "./globals.css";
import ChartRegistry from "./components/ChartRegistry";
import MobileMenuToggle from "./components/MobileMenuToggle";
import PerformanceMonitor from "./components/PerformanceMonitor";
import SessionProvider from "./components/SessionProvider";
import ClientLayout from "./components/ClientLayout";
import { GlobalToastManager } from "./components/Toast";

export const metadata: Metadata = {
  title: "Trading Journal",
  description: "Track and analyze your trading performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
        <SessionProvider>
          <ChartRegistry />
          <ClientLayout>
            {children}
          </ClientLayout>
          <MobileMenuToggle />
          <PerformanceMonitor />
          <GlobalToastManager />
        </SessionProvider>
      </body>
    </html>
  );
}