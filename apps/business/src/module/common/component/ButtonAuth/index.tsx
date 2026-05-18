import { Fingerprint } from "lucide-react";
import type {
    ComponentPropsWithRef,
    PropsWithChildren,
    ReactNode,
} from "react";
import {
    buttonAuth,
    content,
    icon as iconStyle,
    iconWrapper,
    overlay,
    pulsingIcon,
    shimmer,
    spinner,
    text,
} from "./button-auth.css";

type ButtonAuthSize = "none" | "small" | "normal" | "big";
type ButtonAuthWidth = "auto" | "full";

type ButtonAuthProps = ComponentPropsWithRef<"button"> & {
    className?: string;
    size?: ButtonAuthSize;
    width?: ButtonAuthWidth;
    isLoading?: boolean;
    children?: ReactNode;
};

export function ButtonAuth({
    type = "button",
    disabled,
    onClick,
    className = "",
    size,
    isLoading,
    width,
    children,
}: PropsWithChildren<ButtonAuthProps>) {
    return (
        <button
            type={type}
            className={`${buttonAuth({ size, width })} ${className}`.trim()}
            disabled={disabled}
            onClick={onClick}
        >
            <span className={overlay} />

            <span className={content}>
                <ButtonAuthIcon isLoading={isLoading} />
                <span className={text}>{children}</span>
            </span>

            <span className={shimmer} />
        </button>
    );
}

function ButtonAuthIcon({ isLoading }: { isLoading?: boolean }) {
    return (
        <span className={iconWrapper}>
            <Fingerprint
                className={`${iconStyle}${isLoading ? ` ${pulsingIcon}` : ""}`}
            />
            {isLoading && <div className={spinner} />}
        </span>
    );
}
