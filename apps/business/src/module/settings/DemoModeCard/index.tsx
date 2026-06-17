import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { useLogout } from "@/module/common/hook/useLogout";
import { Switch } from "@/module/forms/Switch";
import { SettingsCard } from "../SettingsCard";

export function DemoModeCard() {
    const { t } = useTranslation();
    const { isDemoMode, setDemoMode } = useDemoMode();
    const logout = useLogout();

    return (
        <SettingsCard
            emphasis="cell"
            title={t("settings.demo.label")}
            description={t("settings.demo.description")}
            action={
                <Switch
                    id="demo-mode-switch"
                    checked={isDemoMode}
                    onCheckedChange={(checked) =>
                        checked ? setDemoMode(true) : logout()
                    }
                />
            }
        />
    );
}
