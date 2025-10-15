"use client";

import { Inter } from "next/font/google";
import { useServerInsertedHTML } from "next/navigation";

const font = Inter({
    subsets: ["latin"],
    variable: "--font-family",
    fallback: ["--font-family-sans"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

export function Fonts() {
    useServerInsertedHTML(() => {
        return (
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                      :root {
                        --font-family-sans: '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto',
                          'Ubuntu', 'sans-serif';
                        --font-family: ${font.style.fontFamily};
                      }
                    `,
                }}
            />
        );
    });

    return null;
}
