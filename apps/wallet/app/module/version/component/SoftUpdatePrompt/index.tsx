import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMutation } from "@tanstack/react-query";
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

    if (props.mode === "available") {
        return <AvailableBanner onDismiss={props.onDismiss} t={t} />;
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
            <Card variant="elevated" className={styles.banner}>
                <Box flexDirection="column" gap="s">
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
            </Card>
        );
    }

    return <DownloadedBanner t={t} />;
}

type Translate = ReturnType<typeof useTranslation>["t"];

/**
 * `useMutation` (vs a local `useState(busy)`) gives us a real `isPending`,
 * isolation from unmount races (the `await` resolves after the gate may
 * have re-rendered), and a uniform retry/error surface across the wallet.
 */
function AvailableBanner({
    onDismiss,
    t,
}: {
    onDismiss: () => void;
    t: Translate;
}) {
    const start = useMutation({
        mutationKey: ["version", "start-soft-update"],
        mutationFn: startNativeSoftUpdate,
    });

    return (
        <Card variant="elevated" className={styles.banner}>
            <Box flexDirection="column" gap="s">
                <Text variant="bodySmall">
                    {t("version.softUpdate.available.title")}
                </Text>
                <Text variant="bodySmall">
                    {t("version.softUpdate.available.description")}
                </Text>
                <Box flexDirection="row" gap="s" justifyContent="flex-end">
                    <Button
                        variant="secondary"
                        onClick={onDismiss}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.dismiss")}
                    </Button>
                    <Button
                        onClick={() => start.mutate()}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.available.cta")}
                    </Button>
                </Box>
            </Box>
        </Card>
    );
}

function DownloadedBanner({ t }: { t: Translate }) {
    const complete = useMutation({
        mutationKey: ["version", "complete-soft-update"],
        mutationFn: completeNativeSoftUpdate,
    });

    return (
        <Card variant="elevated" className={styles.banner}>
            <Box flexDirection="column" gap="s">
                <Text variant="bodySmall">
                    {t("version.softUpdate.downloaded.title")}
                </Text>
                <Box flexDirection="row" justifyContent="flex-end">
                    <Button
                        onClick={() => complete.mutate()}
                        disabled={complete.isPending}
                    >
                        {t("version.softUpdate.downloaded.cta")}
                    </Button>
                </Box>
            </Box>
        </Card>
    );
}
