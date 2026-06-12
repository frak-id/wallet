import type { ReactNode } from "react";
import { FormItem, FormLabel, FormMessage } from "@/module/forms/Form";
import * as styles from "./edit-field.css";

type EditFieldProps = {
    label: ReactNode;
    /** Hint rendered under the control. */
    hint?: ReactNode;
    /** `card` wraps the label + control in a white card (sheet styling). */
    tone?: "plain" | "card";
    /** Control(s) — include `FormControl` around the focusable element. */
    children: ReactNode;
};

/**
 * Labeled-field layout shared by the merchant Edit screens and sheets:
 * inset label, control, optional hint and the form error message. Must be
 * rendered inside a `FormField`.
 */
export function EditField({
    label,
    hint,
    tone = "plain",
    children,
}: EditFieldProps) {
    const body = (
        <>
            <FormLabel variant="field" className={styles.label}>
                {label}
            </FormLabel>
            {children}
        </>
    );

    return (
        <FormItem className={tone === "plain" ? styles.item : undefined}>
            {tone === "card" ? <div className={styles.card}>{body}</div> : body}
            {hint && <p className={styles.hint}>{hint}</p>}
            <FormMessage />
        </FormItem>
    );
}
