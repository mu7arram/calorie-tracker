import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  DM_Sans,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description:
    "Daily calorie and macro tracker with quick catalog add, AI meal text lookup, and meal photo analysis.",
};

const FOUC_PREVENTION_SCRIPT = `try{var s=localStorage.getItem("color-scheme");if(s==="light"||s==="dark"){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=s;}var l=localStorage.getItem("locale");if(l==="en"||l==="es"||l==="ar"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${bricolage.variable} ${dmSans.variable} ${ibmPlexArabic.variable}`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{ __html: FOUC_PREVENTION_SCRIPT }}
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
