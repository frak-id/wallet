import clsx from "clsx";
import { overlayStyle } from "./overlay.css";

type OverlayProps = {
    className?: string;
    onClick?: () => void;
};

export function Overlay({ className, onClick }: OverlayProps) {
    return (
        <div
            className={clsx(overlayStyle, className)}
            onClick={onClick}
            onKeyDown={() => {}}
            data-testid="overlay"
        />
    );
}
