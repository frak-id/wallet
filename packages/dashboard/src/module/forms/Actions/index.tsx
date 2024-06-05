import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./index.module.css";

export function Actions() {
    const router = useRouter();

    return (
        <Panel variant={"secondary"} className={styles.actions}>
            <div className={styles.action__left}>
                <Button
                    variant={"outline"}
                    onClick={() => router.push("/campaigns")}
                >
                    Close
                </Button>
                <span
                    className={`${styles.action__message} ${styles["action__message--success"]}`}
                >
                    <Check />
                    All changes have been saved
                </span>
            </div>
            <div className={styles.action__right}>
                <Button variant={"informationOutline"}>Previous</Button>
                <Button type={"submit"} variant={"information"}>
                    Next
                </Button>
            </div>
        </Panel>
    );
}
