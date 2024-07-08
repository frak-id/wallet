import { Login } from "@/module/listener/component/Authenticate/Login";
import { SiweAuthenticate } from "@/module/listener/component/Authenticate/SiweAuthenticate";
import type { ModalEventRequestArgs } from "@/module/listener/types/ModalEvent";
import { RpcErrorCodes } from "@frak-labs/nexus-sdk/core";
import { type PropsWithChildren, useMemo } from "react";
import type { SiweMessage } from "viem/siwe";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function AuthModal({
    args: { emitter, args },
    onHandle,
}: {
    args: Extract<ModalEventRequestArgs, { type: "auth" }>;
    onHandle: () => void;
}) {
    const { address, chainId } = useAccount();

    /**
     * Compute the current step
     */
    const step = useMemo(() => {
        if (!args) {
            return null;
        }

        // If logged in, return the siwe step
        if (address && chainId) {
            const siweMessage: SiweMessage = {
                ...args.siwe,
                address,
                chainId,
            };
            return { key: "siwe", siweMessage } as const;
        }

        // If not logged in, return the siwe step
        return { key: "login" } as const;
    }, [args, address, chainId]);

    const onSuccessLogin = () => {
        // todo: tmp component telling we are waiting for the login propagation??
        // todo: The step should be refreshed automatically
        // todo: But we can have the required info here, maybe force refresh the step here?
    };

    /**
     * The inner component to display
     */
    const component = useMemo(() => {
        // If not logged in, show the login modal
        if (step?.key === "login") {
            return (
                <Login
                    onSuccess={onSuccessLogin}
                    onError={(err) => {
                        emitter({
                            error: {
                                code: RpcErrorCodes.serverError,
                                message: err ?? "Error during the user login",
                            },
                        });
                        onHandle();
                    }}
                />
            );
        }

        return step?.siweMessage ? (
            <SiweAuthenticate
                context={args.context}
                siweMessage={step.siweMessage}
                onSuccess={(signature, message) => {
                    emitter({
                        result: {
                            signature,
                            message,
                        },
                    });
                    onHandle();
                }}
                onError={(err) => {
                    emitter({
                        error: {
                            code: RpcErrorCodes.serverError,
                            message:
                                err ?? "Error during the siwe authentication",
                        },
                    });
                    onHandle();
                }}
            />
        ) : null;
    }, [step, onHandle, emitter, args]);

    if (!(step && emitter)) {
        return null;
    }

    return (
        <>
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
