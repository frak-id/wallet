import { useEscapeKeydown } from "../../hook/useEscapeKeydown";
import styles from "./index.module.css";

type OverlayProps = {
    onOpenChange?: (open: boolean) => void;
};

export function Overlay({ onOpenChange }: OverlayProps) {
    useEscapeKeydown(() => onOpenChange?.(false));

    return (
        <div
            className={styles.overlay}
            onClick={() => onOpenChange?.(false)}
            onKeyDown={() => {}}
        />
    );
}
