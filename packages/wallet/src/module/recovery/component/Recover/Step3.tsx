import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { Password } from "@/module/common/component/Password";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/useRecoveryLocalAccount";
import {
    recoveryFileContentAtom,
    recoveryGuardianAccountAtom,
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const ACTUAL_STEP = 3;

export function Step3() {
    const { t } = useTranslation();
    // Get the recovery file product
    const recoveryFileContent = useAtomValue(recoveryFileContentAtom);

    // Set the password for recovery
    const [password, setPassword] = useAtom(recoveryPasswordAtom);

    // Submit handler that handles the form password submission
    const onSubmit = async ({ password }: { password: string }) => {
        setPassword(password);
    };

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step3")}
        >
            <Password onSubmit={onSubmit} />
            {recoveryFileContent && password && (
                <TriggerPasswordVerification
                    recoveryFileContent={recoveryFileContent}
                />
            )}
        </AccordionRecoveryItem>
    );
}

function TriggerPasswordVerification({
    recoveryFileContent,
}: { recoveryFileContent: RecoveryFileContent }) {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Set the error state
    const [error, setError] = useState<string | null>(null);

    // Get the password for recovery
    const password = useAtomValue(recoveryPasswordAtom);

    // Set the guardian account
    const setGuardianAccount = useSetAtom(recoveryGuardianAccountAtom);

    // Extract the local account from the file
    const { getRecoveryLocalAccountAsync } = useRecoveryLocalAccount();
    useMemo(() => {
        if (!recoveryFileContent) {
            return null;
        }
        async function loadGuardianAccount() {
            if (!password) return;
            try {
                const account = await getRecoveryLocalAccountAsync({
                    file: recoveryFileContent,
                    pass: password,
                });
                setGuardianAccount(account);
                setStep(ACTUAL_STEP + 1);
            } catch (e) {
                // Password must be wrong
                console.error(t("wallet.recovery.errorLoading"), e);
                setError(t("wallet.recovery.invalidPassword"));
            }
        }
        loadGuardianAccount();
    }, [
        recoveryFileContent,
        getRecoveryLocalAccountAsync,
        password,
        setStep,
        setGuardianAccount,
        t,
    ]);

    if (error) {
        return <p className={"error"}>{error}</p>;
    }

    return null;
}
