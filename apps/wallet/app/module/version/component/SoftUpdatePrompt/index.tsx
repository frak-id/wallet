import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
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
 *
 * Layout mirrors the wallet's `ResponsiveModal` confirmation modals
 * (e.g. `DeleteRedemptionConfirmModal`): heading + secondary description
 * up top, full-width stacked actions at the bottom — primary first so the
 * happy-path tap target is closest to the thumb.
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
                <Box className={styles.body}>
                    <Box className={styles.text}>
                        <Text variant="heading4" weight="semiBold">
                            {t("version.softUpdate.inProgress.title", {
                                percent,
                            })}
                        </Text>
                    </Box>
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
            <Box className={styles.body}>
                <Box className={styles.text}>
                    <Text variant="heading4" weight="semiBold">
                        {t("version.softUpdate.available.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("version.softUpdate.available.description")}
                    </Text>
                </Box>
                <Box className={styles.actions}>
                    <Button
                        onClick={() => start.mutate()}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.available.cta")}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onDismiss}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.dismiss")}
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
            <Box className={styles.body}>
                <Box className={styles.successContent}>
                    <IconCircle>
                        <CheckIcon
                            width={24}
                            height={24}
                            className={styles.downloadedIcon}
                        />
                    </IconCircle>
                    <Text variant="heading4" weight="semiBold" align="center">
                        {t("version.softUpdate.downloaded.title")}
                    </Text>
                </Box>
                <Box className={styles.actions}>
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
