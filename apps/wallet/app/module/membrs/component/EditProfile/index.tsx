import { buttonVariants } from "@frak-labs/ui/component/Button";
import { Link } from "@tanstack/react-router";
import { UserPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";

/**
 * Edit the current profile
 * @constructor
 */
export function EditProfile() {
    const { t } = useTranslation();

    return (
        <Panel size={"none"} variant={"invisible"}>
            <Link
                to="/membrs/profile"
                className={buttonVariants({
                    blur: "blur",
                    width: "full",
                    align: "left",
                })}
            >
                <UserPen size={32} />
                {t("wallet.membrs.profile.edit")}
            </Link>
        </Panel>
    );
}
