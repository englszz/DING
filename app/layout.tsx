import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DING — Tu diario musical",
  description:
    "Registra, califica y descubre música. Tu historial de escuchas, tus reseñas, tu mundo musical.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DING",
  },
  openGraph: {
    title: "DING — Tu diario musical",
    description:
      "Registra, califica y descubre música. Tu historial de escuchas, tus reseñas, tu mundo musical.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0097b2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ding-theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
