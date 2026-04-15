import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import type { OnPairingSuccessCallback } from "@frak-labs/wallet-shared";
import { LaunchPairing, ua } from "@frak-labs/wallet-shared";
import { useState } from "react";
import * as styles from "./index.css";

type AuthenticateWithPhoneProps = {
    text: string;
    onSuccess?: OnPairingSuccessCallback;
};

/**
 * Authenticate with phone
 * @param text The text to display on the button
 * @returns A button to authenticate with phone
 */
export function AuthenticateWithPhone({
    text,
    onSuccess,
}: AuthenticateWithPhoneProps) {
    const [isPhoneAuthenticated, setIsPhoneAuthenticated] = useState(false);

    if (ua.isMobile) {
        return null;
    }

    return (
        <>
            <Button
                onClick={() => {
                    setIsPhoneAuthenticated(!isPhoneAuthenticated);
                }}
            >
                {text}
            </Button>
            {isPhoneAuthenticated && (
                <Box className={styles.authenticateWithPhone__fadeIn}>
                    <LaunchPairing onSuccess={onSuccess} />
                </Box>
            )}
        </>
    );
}
