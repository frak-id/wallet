import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExclamationFilledIcon,
    InfoIcon,
} from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import * as styles from "./infoBanner.css";

type InfoBannerProps = {
    /** `info` (default, blue) or `error` (red) tone. */
    tone?: "info" | "error";
    children: ReactNode;
};

/**
 * Bar used across the campaign wizard steps: an icon followed by the message.
 * `info` is the light-blue informational tone; `error` switches to the red
 * feedback tone for failures (e.g. a publish that could not complete).
 */
export function InfoBanner({ tone = "info", children }: InfoBannerProps) {
    const isError = tone === "error";
    return (
        <div className={isError ? styles.bannerError : styles.banner}>
            {isError ? (
                <ExclamationFilledIcon
                    width={20}
                    height={20}
                    className={styles.iconError}
                />
            ) : (
                <InfoIcon width={20} height={20} className={styles.icon} />
            )}
            <Text variant="bodySmall" color="primary">
                {children}
            </Text>
        </div>
    );
}
