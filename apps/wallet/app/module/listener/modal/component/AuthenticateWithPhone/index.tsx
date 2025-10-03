import { ua } from "@/module/common/lib/ua";
import { LaunchPairing } from "@/module/pairing/component/LaunchPairing";
import type { ButtonProps } from "@frak-labs/ui/component/Button";
import { type ElementType, useState } from "react";
import styles from "./index.module.css";

type AuthenticateWithPhoneProps = {
    as?: ElementType;
    text: string;
    className?: string;
    width?: ButtonProps["width"];
};

/**
 * Authenticate with phone
 * @param text The text to display on the button
 * @param className The class name to apply to the button
 * @returns A button to authenticate with phone
 */
export function AuthenticateWithPhone({
    as: Component = "button",
    text,
    className,
    width,
}: AuthenticateWithPhoneProps) {
    const [isPhoneAuthenticated, setIsPhoneAuthenticated] = useState(false);

    if (ua.isMobile) {
        return null;
    }

    return (
        <div>
            <Component
                type={"button"}
                className={className ?? ""}
                width={width}
                onClick={() => {
                    setIsPhoneAuthenticated(!isPhoneAuthenticated);
                }}
            >
                {text}
            </Component>
            {isPhoneAuthenticated && (
                <div className={styles.authenticateWithPhone__fadeIn}>
                    <LaunchPairing />
                </div>
            )}
        </div>
    );
}
