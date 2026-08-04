import { ua } from "@frak-labs/wallet-shared/common";
import type { OnPairingSuccessCallback } from "@frak-labs/wallet-shared/pairing";
import { LaunchPairing } from "@frak-labs/wallet-shared/pairing";
import { type ElementType, type ReactNode, useState } from "react";
import * as styles from "./index.css";

type AuthenticateWithPhoneProps = {
    as?: ElementType;
    text: ReactNode;
    className?: string;
    width?: "auto" | "full";
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
