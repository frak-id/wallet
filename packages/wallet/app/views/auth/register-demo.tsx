import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import {
    privateKeyAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import { Grid } from "@/module/common/component/Grid";
import type { SdkSession, Session } from "@/types/Session";
import { jotaiStore } from "@shared/module/atoms/store";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { Address, Hex } from "viem";
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

function useRegisterDemo(
    options?: UseMutationOptions<Session> & { ssoId?: Hex }
) {
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
        mutationKey: ["register"],
        mutationFn: async () => {
            const session: Session = {
                token: "mockToken",
                address: "0x1234567890" as Address,
                publicKey: "0x1234567890" as Hex,
                authenticatorId: "ecdsa-1234567890" as `ecdsa-${string}`,
                transports: undefined,
            };
            const sdkJwt: SdkSession = {
                token: "mockSdkJwtToken",
                expires: 1000000000000000000,
            };

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);
            jotaiStore.set(privateKeyAtom, "mockPrivateKey");
            return session;
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
