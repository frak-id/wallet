import { hasPaywallContextAtom } from "@/module/paywall/atoms/paywall";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useAtomValue } from "jotai";
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
    const hasPaywallContext = useAtomValue(hasPaywallContextAtom);

    return (
        <AuthFingerprint
            action={async () => {
                setDisabledButton(true);
                await trigger();

                startTransition(() => {
                    router.push(hasPaywallContext ? "/unlock" : "/wallet");
                    setDisabledButton(false);
                });
            }}
            disabled={disabledButton || disabled}
        >
            {children}
        </AuthFingerprint>
    );
}
