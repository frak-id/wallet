import { AccordionLogin } from "@/module/authentication/component/AccordionLogin";
import { LoginItem } from "@/module/authentication/component/LoginItem";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoginList() {
    const { t } = useTranslation();
    const { data: previousAuthenticators } = usePreviousAuthenticators();

    return (
        (previousAuthenticators?.length ?? 0) > 0 && (
            <AccordionLogin
                trigger={
                    <>
                        <HardDrive /> {t("wallet.login.walletsOnDevice")}
                    </>
                }
            >
                <ul>
                    {previousAuthenticators?.map((auth) => (
                        <LoginItem
                            key={`${auth.wallet}`}
                            lastAuthentication={auth}
                        />
                    ))}
                </ul>
            </AccordionLogin>
        )
    );
}
