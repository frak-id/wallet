import { overlayStyle } from "./overlay.css";

type OverlayProps = {
    className?: string;
    onClick?: () => void;
};

export function Overlay({ className, onClick }: OverlayProps) {
    const combinedClassName = [overlayStyle, className]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={combinedClassName}
            onClick={onClick}
            onKeyDown={() => {}}
            data-testid="overlay"
        />
    );
}
