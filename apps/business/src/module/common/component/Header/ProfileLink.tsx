import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronDownIcon, ProfileIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
    profileAvatar,
    profileChevron,
    profileContent,
    profileLabel,
    profileLink,
} from "./header.css";

export function ProfileLink() {
    const { t } = useTranslation();
    return (
        <Link to="/settings" className={profileLink}>
            <span className={profileContent}>
                <span className={profileAvatar}>
                    <ProfileIcon />
                </span>
                <Text
                    as="span"
                    variant="body"
                    weight="medium"
                    className={profileLabel}
                >
                    {t("shell.header.myAccount")}
                </Text>
            </span>
            <span className={profileChevron}>
                <ChevronDownIcon width={24} height={24} />
            </span>
        </Link>
    );
}
