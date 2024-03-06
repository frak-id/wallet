"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useLocalStorage } from "@uidotdev/usehooks";
import { SunMoon } from "lucide-react";
import { useEffect, useState } from "react";

const queryDark = "(prefers-color-scheme: dark)";
const watchSystemTheme = window.matchMedia(queryDark);

/**
 * Switch theme between light and dark mode
 */
export function SwitchTheme() {
    const [theme, setTheme] = useLocalStorage<"light" | "dark" | null>(
        "theme",
        null
    );
    const [themeSystem, setThemeSystem] = useState<"light" | "dark">(
        watchSystemTheme.matches ? "dark" : "light"
    );
    const currentTheme = theme ?? themeSystem;
    const reversedTheme = currentTheme === "light" ? "dark" : "light";

    function useSetTheme(event: MediaQueryListEvent) {
        setThemeSystem(event.matches ? "dark" : "light");
    }

    useEffect(() => {
        const root = document.querySelector(":root") as HTMLElement;
        root.dataset.theme = theme ?? themeSystem;

        watchSystemTheme.addEventListener("change", useSetTheme);

        return () => {
            watchSystemTheme.removeEventListener("change", useSetTheme);
        };
    }, [theme, themeSystem]);

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={() => setTheme(reversedTheme)}
            >
                <Row>
                    <SunMoon size={32} /> Switch theme to {reversedTheme}
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
