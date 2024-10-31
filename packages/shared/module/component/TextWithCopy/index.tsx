import { useCopyToClipboardWithState } from "@module/hook/useCopyToClipboardWithState";
import { Check, Clipboard } from "lucide-react";
import type { CSSProperties, PropsWithChildren } from "react";
import { Button } from "../Button";
import styles from "./index.module.css";

export function TextWithCopy({
    text,
    children,
    style,
}: PropsWithChildren<{ text?: string; style?: CSSProperties }>) {
    const { copied, copy } = useCopyToClipboardWithState();

    if (!text) {
        return null;
    }

    return (
        <div className={styles.textCopy__container} style={style}>
            {children}
            <Button onClick={() => copy(text)} variant={"trigger"}>
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
            </Button>
        </div>
    );
}
