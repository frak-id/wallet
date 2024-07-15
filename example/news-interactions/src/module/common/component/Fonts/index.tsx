"use client";

import { Merriweather, Roboto } from "next/font/google";
import { useServerInsertedHTML } from "next/navigation";

const fontMerriWeather = Merriweather({
    subsets: ["latin"],
    variable: "--font-family-merriWeather",
    fallback: ["--font-family-sans"],
    weight: ["700"],
    display: "swap",
});

const fontRoboto = Roboto({
    subsets: ["latin"],
    variable: "--font-family",
    fallback: ["--font-family-sans"],
    weight: ["400", "500", "700"],
    display: "swap",
});

export function Fonts() {
    useServerInsertedHTML(() => {
        return (
            <style
                // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                dangerouslySetInnerHTML={{
                    __html: `
                      :root {
                        --font-family-sans: '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto',
                          'Ubuntu', 'sans-serif';
                        --font-family: ${fontRoboto.style.fontFamily};
                        --font-family-merriWeather: ${fontMerriWeather.style.fontFamily};
                        --font-family-timesNewRoman: 'Times New Roman', 'Times', 'serif';
                      }
                    `,
                }}
            />
        );
    });

    return null;
}
