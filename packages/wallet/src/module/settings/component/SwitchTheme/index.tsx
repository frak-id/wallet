"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useTheme } from "@/module/settings/provider/ThemeProvider";
import { SunMoon } from "lucide-react";

/**
 * Switch theme between light and dark mode
 */
export function SwitchTheme() {
    const { toggleTheme, reversedTheme } = useTheme();

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple size={"small"} onClick={() => toggleTheme()}>
                <Row>
                    <SunMoon size={32} /> Switch theme to {reversedTheme}
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
