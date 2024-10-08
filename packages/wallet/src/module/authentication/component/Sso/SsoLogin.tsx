import { useLogin } from "@/module/authentication/hook/useLogin";

/**
 * The register component
 * @constructor
 */
export function SsoLoginComponent({ onSuccess }: { onSuccess: () => void }) {
    const { login } = useLogin({
        onSuccess: () => onSuccess(),
    });

    return (
        <button onClick={() => login({})} type={"button"}>
            Connecter un portefeuille existant
        </button>
    );
}
