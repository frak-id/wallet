import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useRouter } from "next/navigation";
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
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [disabledButton, setDisabledButton] = useState(false);

    return (
        <AuthFingerprint
            action={async () => {
                setDisabledButton(true);
                await trigger();

                startTransition(() => {
                    router.push("/wallet");
                    setDisabledButton(false);
                });
            }}
            disabled={disabledButton || disabled}
        >
            {children}
        </AuthFingerprint>
    );
}
