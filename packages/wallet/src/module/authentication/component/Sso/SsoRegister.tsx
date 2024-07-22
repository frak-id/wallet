import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { useMemo } from "react";

/**
 * The register component
 * @constructor
 */
export function SsoRegisterComponent({ onSuccess }: { onSuccess: () => void }) {
    const { register, error, isRegisterInProgress } = useRegister({
        onSuccess: () => onSuccess(),
    });

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () =>
            !!error &&
            "code" in error &&
            error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        [error]
    );

    /**
     * Get the message that will be displayed inside the button
     */
    const message = useMemo(() => {
        if (isPreviouslyUsedAuthenticatorError) {
            return (
                <>
                    Vous avez deja un portfeuille Nexus enregistré. Cliquer su r
                    le bouton de connexion ci-dessous pour vous connecter.
                </>
            );
        }
        if (error) {
            return <>Error during registration, please try again</>;
        }
        if (isRegisterInProgress) {
            return (
                <>
                    Creation de votre portefeuille Nexus en cours
                    <span className={"dotsLoading"}>...</span>
                </>
            );
        }
        return (
            <>Utiliser votre biométrie pour prouver que vous êtes un humain</>
        );
    }, [isPreviouslyUsedAuthenticatorError, error, isRegisterInProgress]);

    return (
        <ButtonAuth
            trigger={register}
            disabled={isPreviouslyUsedAuthenticatorError}
        >
            {message}
        </ButtonAuth>
    );
}
