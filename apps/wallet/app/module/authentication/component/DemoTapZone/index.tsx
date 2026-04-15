import { Box } from "@frak-labs/design-system/components/Box";
import { useDemoTap } from "@/module/authentication/hook/useDemoTap";
import * as styles from "./index.css";

export function DemoTapZone({
    navigate,
    to,
}: {
    navigate: (opts: { to: string }) => void;
    to?: string;
}) {
    const { onTap, enabled } = useDemoTap(navigate, to);

    if (!enabled) return null;

    return (
        <Box
            as="div"
            role="presentation"
            onClick={onTap}
            onKeyDown={undefined}
            className={styles.demoTap}
        />
    );
}
