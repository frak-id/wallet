import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { authKey } from "@/module/authentication/queryKeys/auth";
import { demoPrivateKeyAtom } from "@/module/common/atoms/session";
import { Grid } from "@/module/common/component/Grid";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@shared/module/atoms/store";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { generatePrivateKey } from "viem/accounts";
import { useDemoLogin } from "../../module/authentication/hook/useDemoLogin";
import { trackAuthInitiated } from "../../module/common/analytics";
import styles from "./register.module.css";

export default function RegisterDemo() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [disabled, setDisabled] = useState(false);
    const { register, error, isRegisterInProgress } = useRegisterDemo({
        onSuccess: () => navigate("/wallet"),
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
            <ButtonAuth trigger={register} disabled={disabled}>
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
            // Identify the user and track the event
            await trackAuthInitiated("demo");

            // Generate a private key
            const privateKey = generatePrivateKey();
            jotaiStore.set(demoPrivateKeyAtom, privateKey);

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
