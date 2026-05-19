import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Switch } from "@/module/forms/Switch";
import * as styles from "./demo-mode-switch.css";

export function DemoModeSwitch() {
    const { isDemoMode, setDemoMode } = useDemoMode();

    return (
        <Stack space="s">
            <Inline align="space-between" alignY="center" space="m">
                <label
                    htmlFor="demo-mode-switch"
                    className={styles.demoModeSwitchLabel}
                >
                    Enable Demo Mode
                </label>
                <Switch
                    id="demo-mode-switch"
                    checked={isDemoMode}
                    onCheckedChange={setDemoMode}
                />
            </Inline>
            <Text as="p" variant="bodySmall" color="secondary">
                When enabled, all data will be replaced with mock data for
                demonstration purposes. This is useful for presentations and
                testing without affecting real data.
            </Text>
            {isDemoMode && (
                <p className={styles.demoModeSwitchWarning}>
                    Demo mode is currently active. All operations will be
                    simulated locally.
                </p>
            )}
        </Stack>
    );
}
