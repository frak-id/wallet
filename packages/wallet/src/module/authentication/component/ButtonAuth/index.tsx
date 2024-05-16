import { postAuthRedirectAtom } from "@/module/authentication/atoms/redirection";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { hasPaywallContextAtom } from "@/module/paywall/atoms/paywall";
import { useTriggerReferral } from "@/module/referral/hook/useTriggerReferral";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PropsWithChildren } from "react";

export function ButtonAuth({
    trigger,
    disabled,
    children,
}: PropsWithChildren<{
    trigger: () => Promise<WebAuthNWallet>;
    disabled?: boolean;
}>) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [disabledButton, setDisabledButton] = useState(false);
    const { triggerReferral } = useTriggerReferral();
    const [redirectUrl, setRedirectUrl] = useAtom(postAuthRedirectAtom);
    const hasPaywallContext = useAtomValue(hasPaywallContextAtom);

    return (
        <AuthFingerprint
            action={async () => {
                setDisabledButton(true);
                const wallet = await trigger();
                await triggerReferral(wallet);
                startTransition(() => {
                    if (redirectUrl) {
                        setRedirectUrl(null);
                        window.location.href = decodeURIComponent(redirectUrl);
                        return;
                    }

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
