import type { ButtonProps } from "@frak-labs/ui/component/Button";
import { type ElementType, useState } from "react";
import { ua } from "@/module/common/lib/ua";
import type { OnPairingSuccessCallback } from "@/module/pairing/clients/origin";
import { LaunchPairing } from "@/module/pairing/component/LaunchPairing";
import styles from "./index.module.css";

type AuthenticateWithPhoneProps = {
    as?: ElementType;
    text: string;
    className?: string;
    width?: ButtonProps["width"];
    onSuccess?: OnPairingSuccessCallback;
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
    onSuccess,
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
                    <LaunchPairing onSuccess={onSuccess} />
                </div>
            )}
        </div>
    );
}
