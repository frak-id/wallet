import { useLogin } from "@/module/authentication/hook/useLogin";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";

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
            text={
                <>
                    <h2>Login to your nexus wallet</h2>

                    <ButtonRipple
                        disabled={isLoading}
                        onClick={() => {
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
                    </ButtonRipple>

                    <ButtonRipple
                        disabled={isLoading}
                        onClick={() => onDiscard()}
                    >
                        Exit
                    </ButtonRipple>

                    {/*todo: proper redir infos and UI*/}
                    <p>
                        If you want to create an account, or to recover your
                        wallet from a file, please go to https://nexus.frak.id/
                    </p>
                </>
            }
        />
    );
}
