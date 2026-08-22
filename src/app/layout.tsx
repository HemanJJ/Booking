import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Dearfly 球場預約",
    template: "%s | Dearfly 球場預約",
  },
  description:
    "線上預約羽球、籃球、桌球等運動場地。線上預約、多元場地、安全可靠。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
