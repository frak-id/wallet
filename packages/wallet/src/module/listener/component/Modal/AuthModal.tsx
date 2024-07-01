import { Login } from "@/module/listener/component/Authenticate/Login";
import { SiweAuthenticate } from "@/module/listener/component/Authenticate/SiweAuthenticate";
import { ListenerModalHeader } from "@/module/listener/component/Modal/index";
import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import { type PropsWithChildren, useMemo } from "react";
import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function AuthModal({
    args: { listener },
    onHandle,
}: {
    args: Extract<modalEventRequestArgs, { type: "auth" }>;
    onHandle: () => void;
}) {
    const { address, chainId } = useAccount();

    /**
     * Compute the current step
     */
    const step = useMemo(() => {
        if (!listener) {
            return null;
        }

        // If logged in, return the siwe step
        if (address && chainId) {
            const siweMessage: SiweMessage = {
                ...listener.siweMessage,
                address,
                chainId,
            };
            return { key: "siwe", siweMessage } as const;
        }

        // If not logged in, return the siwe step
        return { key: "login" } as const;
    }, [listener, address, chainId]);

    const onError = (reason?: string) => {
        listener.emitter({
            key: "error",
            reason,
        });
    };

    const onSuccessLogin = () => {
        // todo: tmp component telling we are waiting for the login propagation??
        // todo: The step should be refreshed automatically
        // todo: But we can have the required info here, maybe force refresh the step here?
    };

    const onSuccessAuth = (signature: Hex, message: string) => {
        listener.emitter({
            key: "success",
            signature,
            message,
        });
        onHandle();
    };

    /**
     * The inner component to display
     */
    const component = useMemo(() => {
        // If not logged in, show the login modal
        if (step?.key === "login") {
            return <Login onSuccess={onSuccessLogin} onError={onError} />;
        }

        return step?.siweMessage ? (
            <SiweAuthenticate
                context={listener.context}
                siweMessage={step.siweMessage}
                onSuccess={onSuccessAuth}
                onError={onError}
            />
        ) : null;
    }, [step, onError, listener.context, onSuccessAuth]);

    if (!(step && listener)) {
        return null;
    }

    return (
        <>
            <ListenerModalHeader title={"Nexus Wallet"} />
            <Steps>
                <StepItem isActive={step.key === "login"}>Login</StepItem>
                <StepItem isActive={step.key === "siwe"}>
                    Authentication
                </StepItem>
            </Steps>
            {component}
        </>
    );
}

function Steps({ children }: PropsWithChildren) {
    return <div className={styles.modalListener__steps}>{children}</div>;
}

function StepItem({
    isActive,
    children,
}: PropsWithChildren<{ isActive: boolean }>) {
    return (
        <div
            className={`${styles.modalListener__stepItem} ${isActiveStep(
                isActive
            )}`}
        >
            {children}
        </div>
    );
}

function isActiveStep(isActive: boolean) {
    return isActive ? styles["modalListener__stepItem--active"] : "";
}
