import type { MoneriumOrderDto } from "@backend-domain/monerium/schemas";
import { CloseIcon, LockIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import * as styles from "./index.css";

const iconSize = { s: 12, m: 14 } as const;

/** Corner badge on an order icon; nothing once the order is processed. */
export function OrderStateBadge({
    state,
    size = "s",
}: {
    state: MoneriumOrderDto["state"];
    size?: keyof typeof iconSize;
}) {
    if (state === "processed") return null;
    const status = state === "rejected" ? "rejected" : "pending";
    const Icon = status === "rejected" ? CloseIcon : LockIcon;
    return (
        <div className={styles.badge({ size })}>
            <div className={styles.badgeInner({ status })}>
                <Icon
                    color={vars.surface.background}
                    width={iconSize[size]}
                    height={iconSize[size]}
                />
            </div>
        </div>
    );
}
