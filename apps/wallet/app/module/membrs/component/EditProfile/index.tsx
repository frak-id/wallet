import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { UserPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";

/**
 * Edit the current profile
 * @constructor
 */
export function EditProfile() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Panel size={"none"} variant={"invisible"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                onClick={async () => {
                    navigate({ to: "/membrs/profile" });
                }}
                leftIcon={<UserPen size={32} />}
            >
                {t("wallet.membrs.profile.edit")}
            </Button>
        </Panel>
    );
}
