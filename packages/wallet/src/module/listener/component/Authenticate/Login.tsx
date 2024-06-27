import { useLogin } from "@/module/authentication/hook/useLogin";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ListenerModalHeader } from "@/module/listener/component/Modal";
import styles from "@/module/listener/component/Modal/index.module.css";

/**
 * Modal used to perform a login before a siwe signature
 * @param onSuccess
 * @param onError
 * @constructor
 */
export function Login({
    onSuccess,
    onError,
}: { onSuccess: () => void; onError: (reason?: string) => void }) {
    const { login, isSuccess, isLoading, isError, error } = useLogin();

    return (
        <>
            <ListenerModalHeader title={"Nexus Wallet - Login"} />
            <Panel size={"normal"}>
                <Title>Welcome to your dashboard</Title>
                <br />
                <p>
                    Please connect your{" "}
                    <a href={process.env.APP_URL}>Nexus wallet</a> to access
                    your personalized dashboard.
                </p>
                <p>
                    If you want to create an account, or to recover your wallet
                    from a file, please go to{" "}
                    <a href={process.env.APP_URL}>https://nexus.frak.id/</a>
                </p>
                <p>
                    Need help? Contact us at{" "}
                    <a href="mailto:hello@frak.id">hello@frak.id</a>
                </p>
            </Panel>
            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isLoading}
                action={() => {
                    login({})
                        .then(() => {
                            onSuccess();
                        })
                        .catch((error) => {
                            onError(error.message);
                        });
                }}
            />

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
