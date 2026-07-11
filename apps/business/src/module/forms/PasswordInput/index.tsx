import { EyeIcon, EyeOffIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "@/module/forms/Input";
import * as styles from "./password-input.css";

/**
 * Password field with a show/hide reveal toggle rendered in the DS Input's
 * `rightSection`. Forwards every other `Input` prop (label, hint, error,
 * autoComplete…) untouched.
 */
export function PasswordInput({
    type: _type,
    rightSection: _rightSection,
    ...props
}: InputProps) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    return (
        <Input
            {...props}
            type={visible ? "text" : "password"}
            rightSection={
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setVisible((prev) => !prev)}
                    aria-label={t(
                        visible ? "common.hidePassword" : "common.showPassword"
                    )}
                >
                    {visible ? (
                        <EyeOffIcon width={18} height={18} />
                    ) : (
                        <EyeIcon width={18} height={18} />
                    )}
                </button>
            }
        />
    );
}
