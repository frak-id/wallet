import { AuthFingerprint } from "@shared/module/component/AuthFingerprint";
import { useState } from "react";
import type { PropsWithChildren } from "react";

export function ButtonAuth({
    trigger,
    disabled,
    children,
}: PropsWithChildren<{
    trigger: () => Promise<unknown>;
    disabled?: boolean;
}>) {
    const [disabledButton, setDisabledButton] = useState(false);

    return (
        <AuthFingerprint
            action={async () => {
                setDisabledButton(true);
                await trigger();
                setDisabledButton(false);
            }}
            disabled={disabledButton || disabled}
        >
            {children}
        </AuthFingerprint>
    );
}
