import { RadioGroupItem } from "@frak-labs/design-system/components/RadioGroup";
import { Text } from "@frak-labs/design-system/components/Text";
import clsx from "clsx";
import { type ReactNode, useId } from "react";
import * as styles from "./radio-option.css";

type RadioOptionProps = {
    value: string;
    label: ReactNode;
    icon?: ReactNode;
    fill?: boolean;
};

export function RadioOption({ value, label, icon, fill }: RadioOptionProps) {
    const id = useId();
    return (
        <label
            htmlFor={id}
            className={clsx(styles.option, fill && styles.optionFill)}
        >
            <RadioGroupItem id={id} value={value} size="l" />
            <span className={styles.content}>
                {icon && <span className={styles.icon}>{icon}</span>}
                <Text as="span" variant="body" weight="medium">
                    {label}
                </Text>
            </span>
        </label>
    );
}
