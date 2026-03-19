import { Box } from "@frak-labs/design-system/components/Box";
import type { OnPairingSuccessCallback } from "@frak-labs/wallet-shared";
import { LaunchPairing, ua } from "@frak-labs/wallet-shared";
import { type ElementType, useState } from "react";
import * as styles from "./index.css";

type AuthenticateWithPhoneProps = {
    as?: ElementType;
    text: string;
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
        <Box>
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
                <Box className={styles.authenticateWithPhone__fadeIn}>
                    <LaunchPairing onSuccess={onSuccess} />
                </Box>
            )}
        </Box>
    );
}
