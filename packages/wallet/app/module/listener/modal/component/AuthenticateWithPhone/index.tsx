import { LaunchPairing } from "@/module/pairing/component/LaunchPairing";
import { useState } from "react";
import styles from "./index.module.css";

type AuthenticateWithPhoneProps = {
    text: string;
    className: string;
};

/**
 * Authenticate with phone
 * @param text The text to display on the button
 * @param className The class name to apply to the button
 * @returns A button to authenticate with phone
 */
export function AuthenticateWithPhone({
    text,
    className,
}: AuthenticateWithPhoneProps) {
    const [isPhoneAuthenticated, setIsPhoneAuthenticated] = useState(false);

    return (
        <div>
            <button
                type={"button"}
                className={className}
                onClick={() => {
                    setIsPhoneAuthenticated(!isPhoneAuthenticated);
                }}
            >
                {text}
            </button>
            {isPhoneAuthenticated && (
                <div className={styles.authenticateWithPhone__fadeIn}>
                    <LaunchPairing />
                </div>
            )}
        </div>
    );
}
