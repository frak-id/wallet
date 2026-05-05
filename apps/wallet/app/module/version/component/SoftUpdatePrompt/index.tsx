import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    completeNativeSoftUpdate,
    startNativeSoftUpdate,
} from "../../utils/nativeUpdater";
import * as styles from "./index.css";

type SoftUpdatePromptProps =
    | { mode: "available"; storeVersion?: string; onDismiss: () => void }
    | {
          mode: "in_progress";
          bytesDownloaded: number;
          totalBytes: number;
      }
    | { mode: "downloaded" };

/**
 * Dismissible banner shown when a soft update is available.
 *
 * `available`    — initial CTA. On tap kicks off the FLEXIBLE flow on
 *                  Android (Play download dialog) or opens the App Store
 *                  on iOS. Banner is dismissible — user can keep using
 *                  the app and we'll re-show on next focus check.
 * `in_progress`  — Android only. Shows download progress while Play
 *                  pulls the update in the background.
 * `downloaded`   — Android only. Final "Restart now" CTA that calls
 *                  `completeUpdate()` to install + relaunch.
 */
export function SoftUpdatePrompt(props: SoftUpdatePromptProps) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);

    if (props.mode === "available") {
        async function handleStart() {
            if (busy) return;
            setBusy(true);
            await startNativeSoftUpdate();
            setBusy(false);
        }

        return (
            <Box className={styles.banner} flexDirection="column" gap="s">
                <Text variant="bodySmall">
                    {t("version.softUpdate.available.title")}
                </Text>
                <Text variant="bodySmall">
                    {t("version.softUpdate.available.description")}
                </Text>
                <Box flexDirection="row" gap="s" justifyContent="flex-end">
                    <Button
                        variant="secondary"
                        onClick={props.onDismiss}
                        disabled={busy}
                    >
                        {t("version.softUpdate.dismiss")}
                    </Button>
                    <Button onClick={handleStart} disabled={busy}>
                        {t("version.softUpdate.available.cta")}
                    </Button>
                </Box>
            </Box>
        );
    }

    if (props.mode === "in_progress") {
        const percent =
            props.totalBytes > 0
                ? Math.min(
                      100,
                      Math.round(
                          (props.bytesDownloaded / props.totalBytes) * 100
                      )
                  )
                : 0;

        return (
            <Box className={styles.banner} flexDirection="column" gap="s">
                <Text variant="bodySmall">
                    {t("version.softUpdate.inProgress.title", { percent })}
                </Text>
                <div className={styles.progressTrack}>
                    <div
                        className={styles.progressBar}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </Box>
        );
    }

    async function handleComplete() {
        if (busy) return;
        setBusy(true);
        await completeNativeSoftUpdate();
        setBusy(false);
    }

    return (
        <Box className={styles.banner} flexDirection="column" gap="s">
            <Text variant="bodySmall">
                {t("version.softUpdate.downloaded.title")}
            </Text>
            <Box flexDirection="row" justifyContent="flex-end">
                <Button onClick={handleComplete} disabled={busy}>
                    {t("version.softUpdate.downloaded.cta")}
                </Button>
            </Box>
        </Box>
    );
}
