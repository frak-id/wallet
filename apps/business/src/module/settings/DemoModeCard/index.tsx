import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Switch } from "@/module/forms/Switch";
import { SettingsCard } from "../SettingsCard";

export function DemoModeCard() {
    const { t } = useTranslation();
    const { isDemoMode, setDemoMode } = useDemoMode();

    return (
        <SettingsCard
            emphasis="cell"
            title={t("settings.demo.label")}
            description={t("settings.demo.description")}
            action={
                <Switch
                    id="demo-mode-switch"
                    checked={isDemoMode}
                    onCheckedChange={setDemoMode}
                />
            }
        />
    );
}
