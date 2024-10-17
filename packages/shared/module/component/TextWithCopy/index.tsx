import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { Check, Clipboard } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Button } from "../Button";
import styles from "./index.module.css";

export function TextWithCopy({
    text,
    children,
}: PropsWithChildren<{ text: string }>) {
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        <div className={styles.textCopy__container}>
            {children}
            <Button onClick={() => copy(text)} variant={"trigger"}>
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
            </Button>
        </div>
    );
}
