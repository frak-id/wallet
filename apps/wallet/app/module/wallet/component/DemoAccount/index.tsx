import { decodeJwt } from "jose";
import { atom, useAtomValue } from "jotai";
import {
    demoPrivateKeyAtom,
    type SdkSessionPayload,
    sdkSessionAtom,
} from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import styles from "./index.module.css";

const isDemoAccountAtom = atom((get) => {
    const demoPkey = get(demoPrivateKeyAtom);
    if (demoPkey) return true;

    const sdkSession = get(sdkSessionAtom);
    if (!sdkSession) return false;

    const parsedSession = decodeJwt<SdkSessionPayload>(sdkSession.token);
    if (!parsedSession) return false;

    return parsedSession?.additionalData?.demoPkey !== undefined;
});

export function DemoAccount() {
    const isDemoAccount = useAtomValue(isDemoAccountAtom);
    if (!isDemoAccount) {
        return null;
    }

    return (
        <Panel variant={"invisible"} size={"none"}>
            <div className={styles.demoAccount}>
                <p>
                    <span className={styles.demoAccount__warning}>&#9888;</span>{" "}
                    Demo Account
                </p>
            </div>
        </Panel>
    );
}
