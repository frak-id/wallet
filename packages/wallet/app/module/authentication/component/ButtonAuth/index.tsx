import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useNavigate } from "@remix-run/react";
import { useState, useTransition } from "react";
import type { PropsWithChildren } from "react";

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
