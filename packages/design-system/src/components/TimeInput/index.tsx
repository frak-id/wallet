import type { ComponentProps } from "react";
import { ClockIcon } from "../../icons";
import { Input } from "../Input";
import * as styles from "./time-input.css";

type TimeInputProps = Omit<
    ComponentProps<typeof Input>,
    "type" | "leftSection" | "rightSection"
>;

/**
 * Native `<input type="time">` with the browser's clock indicator hidden so
 * the field stays cleanly typeable (`HH:mm`), plus a static clock icon — the
 * shadcn time-picker pattern. Pair `variant`/`tone` like any DS Input.
 */
export function TimeInput({ className, ...props }: TimeInputProps) {
    return (
        <Input
            type="time"
            className={className}
            inputClassName={styles.input}
            rightSection={
                <ClockIcon width={20} height={20} className={styles.icon} />
            }
            {...props}
        />
    );
}
