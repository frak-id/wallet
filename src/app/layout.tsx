import { Inter } from "next/font/google";
import {ReactNode} from "react";
import {Viewport} from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Frak Wallet",
  description:
      "POC showcasing ERC-4337 with WebAuthN inside the frak ecosystem.",
  authors: [
      { name: "Frak" },
      { name: "Rodolphe Stoclin\n", url: "https://github.com/srod"},
      { name: "Quentin Nivelais", url: "https://github.com/KONFeature" },
  ],
  icons: {
    icon: [
      { rel: "icon", url: "/favicons/favicon.ico", sizes: "32x32" },
      { rel: "icon", url: "/favicons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      {
        url: "/favicons/icon-192.png",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#001432",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
