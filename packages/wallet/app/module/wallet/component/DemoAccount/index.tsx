import { privateKeyAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { useAtomValue } from "jotai";
import styles from "./index.module.css";

export function DemoAccount() {
    const privateKey = useAtomValue(privateKeyAtom);

    if (!privateKey) {
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
