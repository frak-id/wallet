import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { CallOut } from "@/module/common/component/CallOut";
import { Switch } from "@/module/forms/Switch";
import * as styles from "./demo-mode-switch.css";

export function DemoModeSwitch() {
    const { t } = useTranslation();
    const { isDemoMode, setDemoMode } = useDemoMode();

    return (
        <Stack space="s">
            <Inline align="space-between" alignY="center" space="m">
                <label
                    htmlFor="demo-mode-switch"
                    className={styles.demoModeSwitchLabel}
                >
                    {t("settings.demo.label")}
                </label>
                <Switch
                    id="demo-mode-switch"
                    checked={isDemoMode}
                    onCheckedChange={setDemoMode}
                />
            </Inline>
            <Text as="p" variant="bodySmall" color="secondary">
                {t("settings.demo.description")}
            </Text>
            {isDemoMode && (
                <CallOut variant="warning">{t("settings.demo.active")}</CallOut>
            )}
        </Stack>
    );
}
