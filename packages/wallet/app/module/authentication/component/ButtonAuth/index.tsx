import { AuthFingerprint } from "@shared/module/component/AuthFingerprint";
import { useState, useTransition } from "react";
import type { PropsWithChildren } from "react";
import { useNavigate } from "react-router";

export function ButtonAuth({
    trigger,
    disabled,
    children,
}: PropsWithChildren<{
    trigger: () => Promise<unknown>;
    disabled?: boolean;
}>) {
    const navigate = useNavigate();
    const [, startTransition] = useTransition();
    const [disabledButton, setDisabledButton] = useState(false);

    return (
        <AuthFingerprint
            action={async () => {
                setDisabledButton(true);
                await trigger();

                startTransition(() => {
                    navigate("/wallet");
                    setDisabledButton(false);
                });
            }}
            disabled={disabledButton || disabled}
        >
            {children}
        </AuthFingerprint>
    );
}
