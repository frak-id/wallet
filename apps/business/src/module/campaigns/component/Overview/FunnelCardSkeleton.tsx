import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import * as styles from "./overview.css";

const FUNNEL_STEP_WIDTHS = ["100%", "82%", "64%", "46%", "28%"];

export function FunnelCardSkeleton() {
    return (
        <div className={styles.card}>
            <Stack space="m">
                <Inline space="xs">
                    <Skeleton variant="rect" width={88} height={32} />
                    <Skeleton variant="rect" width={88} height={32} />
                </Inline>
                <Skeleton variant="text" width="40%" height={14} />
                <Stack space="xs">
                    {FUNNEL_STEP_WIDTHS.map((width) => (
                        <Skeleton
                            key={width}
                            variant="rect"
                            width={width}
                            height={40}
                        />
                    ))}
                </Stack>
            </Stack>
        </div>
    );
}
