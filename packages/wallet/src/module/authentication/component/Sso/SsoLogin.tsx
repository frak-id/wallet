import { useLogin } from "@/module/authentication/hook/useLogin";
import { useTranslation } from "react-i18next";

/**
 * The register component
 * @constructor
 */
export function SsoLoginComponent({ onSuccess }: { onSuccess: () => void }) {
    const { t } = useTranslation();
    const { login } = useLogin({
        onSuccess: () => onSuccess(),
    });

    return (
        <button onClick={() => login({})} type={"button"}>
            {t("authent.sso.btn.login")}
        </button>
    );
}
