import type { SdkSessionPayload } from "@frak-labs/wallet-shared";
import {
    selectDemoPrivateKey,
    selectSdkSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { decodeJwt } from "jose";
import { Panel } from "@/module/common/component/Panel";
import * as styles from "./index.css";

export function DemoAccount() {
    const demoPkey = sessionStore(selectDemoPrivateKey);
    const sdkSession = sessionStore(selectSdkSession);

    const isDemoAccount = (() => {
        if (demoPkey) return true;
        if (!sdkSession) return false;

        const parsedSession = decodeJwt<SdkSessionPayload>(sdkSession.token);
        if (!parsedSession) return false;

        return parsedSession?.additionalData?.demoPkey !== undefined;
    })();

    if (!isDemoAccount) {
        return null;
    }

    return (
        <Panel variant={"invisible"} size={"none"}>
            <div className={styles.demoAccount}>
                <p className={styles.demoAccountParagraph}>
                    <span className={styles.demoAccountWarning}>&#9888;</span>{" "}
                    Demo Account
                </p>
            </div>
        </Panel>
    );
}
