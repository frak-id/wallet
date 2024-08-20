import { currentChain } from "@/context/blockchain/provider";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import { recoveryOptionsAtom } from "@/module/settings/atoms/recovery";
import { Button } from "@module/component/Button";
import { useAtomValue } from "jotai";
import { Check, X } from "lucide-react";

export function ButtonSetupRecovery({
    className = "",
    onSuccess,
}: { className?: string; onSuccess: () => void }) {
    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Setup recovery
    const { setupRecoveryAsync, isPending, isSuccess, isError, error } =
        useSetupRecovery({
            onSuccess: () => {
                onSuccess();
            },
        });

    return (
        <>
            <Button
                isLoading={isPending}
                disabled={isPending || isSuccess}
                onClick={async () => {
                    if (!recoveryOptions) return;
                    await setupRecoveryAsync({
                        setupTxData: recoveryOptions.setupTxData,
                    });
                    onSuccess();
                }}
                leftIcon={isSuccess ? <Check /> : isError ? <X /> : undefined}
                className={className}
            >
                Setup recovery on {currentChain.name}
            </Button>
            <span className="error">{isError ? error.message : ""}</span>
        </>
    );
}
