import { AuthFingerprint } from "@frak-labs/ui/component/AuthFingerprint";
import { useState } from "react";
import type { PropsWithChildren } from "react";

export function ButtonAuth({
    trigger,
    disabled,
    isLoading,
    children,
}: PropsWithChildren<{
    trigger: () => Promise<unknown>;
    disabled?: boolean;
    isLoading?: boolean;
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
            isLoading={isLoading}
        >
            {children}
        </AuthFingerprint>
    );
}
