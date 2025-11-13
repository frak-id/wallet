import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import type { Session } from "@frak-labs/wallet-shared";
import { authKey, sessionStore } from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { generatePrivateKey } from "viem/accounts";
import { useDemoLogin } from "@/module/authentication/hook/useDemoLogin";
import { Grid } from "@/module/common/component/Grid";
import styles from "./register.module.css";

export const Route = createFileRoute("/_wallet/_auth/register/demo")({
    component: RegisterDemo,
});

function RegisterDemo() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [disabled, setDisabled] = useState(false);
    const { register, error, isRegisterInProgress } = useRegisterDemo({
        onSuccess: () => navigate({ to: "/wallet" }),
    });

    /**
     * Get the message that will displayed inside the button
     */
    const message = useMemo(() => {
        if (error) {
            return t("wallet.registerDemo.button.error");
        }
        if (isRegisterInProgress) {
            return t("wallet.registerDemo.button.inProgress");
        }
        return <Trans i18nKey={"wallet.registerDemo.button.create"} />;
    }, [error, isRegisterInProgress, t]);

    useEffect(() => {
        if (!error) return;

        setDisabled(false);
    }, [error]);

    return (
        <Grid className={styles.register__grid}>
            <ButtonAuth onClick={() => register()} disabled={disabled}>
                {message}
            </ButtonAuth>
        </Grid>
    );
}

function useRegisterDemo(options?: UseMutationOptions<Session>) {
    const { mutateAsync: demoLogin } = useDemoLogin();
    /**
     * Mutation used to launch the registration process
     */
    const {
        isPending: isRegisterInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync: register,
    } = useMutation({
        ...options,
        mutationKey: authKey.demo.register,
        mutationFn: async () => {
            // Generate a private key
            const privateKey = generatePrivateKey();
            sessionStore.getState().setDemoPrivateKey(privateKey);

            // Launch the demo login
            return await demoLogin({ pkey: privateKey });
        },
    });

    return {
        isRegisterInProgress,
        isSuccess,
        isError,
        error,
        register,
    };
}
