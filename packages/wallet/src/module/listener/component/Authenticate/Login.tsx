import { useLogin } from "@/module/authentication/hook/useLogin";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";

/**
 * Modal used to perform a login before a siwe signature
 * @param siweMessage
 * @param isOpen
 * @param onSuccess
 * @param onError
 * @param onDiscard
 * @constructor
 */
export function SiweLoginModal({
    isOpen,
    onSuccess,
    onError,
    onDiscard,
}: {
    isOpen: boolean;
    onSuccess: () => void;
    onError: (reason?: string) => void;
    onDiscard: () => void;
}) {
    const { login, isLoading } = useLogin();

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onDiscard();
                }
            }}
            title={"Nexus Wallet - Login"}
            text={
                <>
                    {/*todo: proper redir infos and UI*/}
                    <p>
                        If you want to create an account, or to recover your
                        wallet from a file, please go to https://nexus.frak.id/
                    </p>
                </>
            }
            action={
                <AuthFingerprint
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
                >
                    Login
                </AuthFingerprint>
            }
        />
    );
}
