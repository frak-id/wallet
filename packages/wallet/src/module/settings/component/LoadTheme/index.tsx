"use client";

import Script from "next/script";

/**
 * Load the theme from local storage or system theme
 * @constructor
 */
export function LoadTheme() {
    return (
        <Script id="theme" strategy="afterInteractive">
            {`
                    function setTheme(newTheme) {
                        console.log("Setting theme to", newTheme);
                        document.querySelector(":root").dataset.theme = newTheme;
                    }
                    const queryDark = "(prefers-color-scheme: dark)";
                    const watchSystemTheme = window.matchMedia(queryDark);
                    const themeSystem = watchSystemTheme.matches ? "dark" : "light";
                    const themeLocalStorage = JSON.parse(localStorage.getItem("theme"));
                    setTheme(themeLocalStorage ?? themeSystem);
                    watchSystemTheme.addEventListener("change", function (event) {
                        const themeLocalStorage = JSON.parse(localStorage.getItem("theme"));
                        if(themeLocalStorage === null) {
                            setTheme(event.matches ? "dark" : "light");
                        }
                    });
                `}
        </Script>
    );
}
