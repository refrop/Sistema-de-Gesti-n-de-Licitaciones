import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sistema de Gestión de Licitaciones",
    template: "%s | SisGest",
  },
  description:
    "Gestión integral de licitaciones: clientes, productos, propuestas, envíos y cobros.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('sisgest-theme')==='light'){var r=document.documentElement;r.classList.add('theme-boot');r.setAttribute('data-theme','light');requestAnimationFrame(function(){requestAnimationFrame(function(){r.classList.remove('theme-boot')})})}}catch(e){}})()",
          }}
        />
        {children}
        <Toaster position="top-right" />
        <Script src="/vv-buttons.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
