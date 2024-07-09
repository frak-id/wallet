"use client";

import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import {
    reversedThemeAtom,
    toggleThemeAtom,
} from "@/module/settings/atoms/theme";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useAtomValue, useSetAtom } from "jotai";
import { SunMoon } from "lucide-react";

/**
 * Switch theme between light and dark mode
 */
export function SwitchTheme() {
    const toggleTheme = useSetAtom(toggleThemeAtom);
    const reversedTheme = useAtomValue(reversedThemeAtom);

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
