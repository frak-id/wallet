import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { BellIcon, FaceIdIcon } from "@frak-labs/design-system/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBiometryLabel } from "@/module/biometrics/hooks/useBiometryLabel";
import {
    type BiometricLockTimeout,
    biometricsStore,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
    selectIsAvailable,
} from "@/module/biometrics/stores/biometricsStore";
import { authenticateWithBiometrics } from "@/module/biometrics/utils/biometrics";
import { notificationAdapter } from "@/module/notification/adapter";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import {
    SettingsCard,
    SettingsRow,
} from "@/module/settings/component/SettingsCard";
import * as styles from "./index.css";

function NotificationRow() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { hasLocalCapability } = useNotificationStatus();
    const { unsubscribeFromPush, isPending } =
        useUnsubscribeFromPushNotification();

    if (!hasLocalCapability) {
        return null;
    }

    const handleManageNotifications = async () => {
        await notificationAdapter.openSettings();
        await queryClient.invalidateQueries({
            queryKey: notificationKey.push.permission,
        });
    };

    const handleToggle = async (checked: boolean) => {
        if (isTauri()) {
            await handleManageNotifications();
            return;
        }
        if (!checked) {
            unsubscribeFromPush();
        }
    };

    return (
        <SettingsCard>
            <SettingsRow
                icon={BellIcon}
                label={t("wallet.profile.notificationSettings")}
                action={
                    <Switch
                        checked={true}
                        disabled={isPending}
                        onCheckedChange={handleToggle}
                    />
                }
            />
        </SettingsCard>
    );
}

function BiometricRow() {
    const { t } = useTranslation();
    const biometryLabel = useBiometryLabel();
    const enabled = biometricsStore(selectBiometricsEnabled);
    const lockTimeout = biometricsStore(selectBiometricsLockTimeout);
    const setEnabled = biometricsStore((state) => state.setEnabled);
    const setLockTimeout = biometricsStore((state) => state.setLockTimeout);
    const isAvailable = biometricsStore(selectIsAvailable);

    if (!isTauri() || !isAvailable) {
        return null;
    }

    const handleToggle = async (checked: boolean) => {
        if (!checked) {
            setEnabled(false);
            return;
        }

        const result = await authenticateWithBiometrics({
            reason: t("biometrics.settings.enable"),
        });

        if (result.success) {
            setEnabled(true);
        }
    };

    const handleTimeoutChange = (value: string) => {
        setLockTimeout(value as BiometricLockTimeout);
    };

    return (
        <SettingsCard>
            <SettingsRow
                icon={FaceIdIcon}
                align="top"
                label={t("wallet.profile.biometricPrompt", {
                    defaultValue:
                        "Require {{biometryLabel}} at every app launch",
                    biometryLabel,
                })}
                action={
                    <Switch checked={enabled} onCheckedChange={handleToggle} />
                }
            />
            {enabled ? (
                <SettingsRow
                    icon={ShieldCheck}
                    label={t("biometrics.settings.timeout")}
                    action={
                        <Select
                            value={lockTimeout}
                            onValueChange={handleTimeoutChange}
                        >
                            <SelectTrigger className={styles.selectTrigger}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="immediate">
                                    {t("biometrics.settings.timeoutImmediate")}
                                </SelectItem>
                                <SelectItem value="1min">
                                    {t("biometrics.settings.timeout1min")}
                                </SelectItem>
                                <SelectItem value="5min">
                                    {t("biometrics.settings.timeout5min")}
                                </SelectItem>
                                <SelectItem value="15min">
                                    {t("biometrics.settings.timeout15min")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    }
                />
            ) : null}
        </SettingsCard>
    );
}

export function ProfilePreferencesCard() {
    const { hasLocalCapability } = useNotificationStatus();
    const isBiometricsAvailable = biometricsStore(selectIsAvailable);

    return (
        <>
            {hasLocalCapability && <NotificationRow />}
            {isBiometricsAvailable && <BiometricRow />}
        </>
    );
}
