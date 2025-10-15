import { Button } from "@frak-labs/ui/component/Button";
import { UserPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
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
                    navigate("/membrs/profile", { viewTransition: true });
                }}
                leftIcon={<UserPen size={32} />}
            >
                {t("wallet.membrs.profile.edit")}
            </Button>
        </Panel>
    );
}
