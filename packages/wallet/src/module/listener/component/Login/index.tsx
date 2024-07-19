import { useLogin } from "@/module/authentication/hook/useLogin";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { LoginModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixGlobalCss } from "@module/utils/prefixGlobalCss";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function LoginModalStep({
    params,
    onFinish,
    onError,
}: {
    params: LoginModalStepType["params"];
    onFinish: (args: LoginModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { metadata } = params;
    const { login, isSuccess, isLoading, isError, error } = useLogin();

    return (
        <>
            {metadata?.description && (
                <div className={prefixGlobalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixGlobalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixGlobalCss("button-primary")}
                        disabled={isLoading}
                        onClick={() => {
                            login({})
                                .then((authResult) => {
                                    // todo: save the step result
                                    onFinish({
                                        wallet: authResult.wallet.address,
                                    });
                                })
                                .catch((error) => {
                                    onError(error.message);
                                });
                        }}
                    >
                        {metadata?.primaryActionText ?? "Login"}
                    </button>
                </div>
                {metadata?.secondaryActionText && (
                    <div>
                        <button
                            type={"button"}
                            className={prefixGlobalCss("button-secondary")}
                        >
                            {metadata.secondaryActionText}
                        </button>
                    </div>
                )}
            </div>

            {isSuccess && (
                <p className={styles.modalListener__success}>
                    Connection successful
                </p>
            )}

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
