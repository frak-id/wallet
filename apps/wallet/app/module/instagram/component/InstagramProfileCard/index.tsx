import { Badge } from "@frak-labs/design-system/components/Badge";
import { InstagramIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { instagramLink } from "@/module/instagram/config";
import {
    useInstagramStatus,
    useRefreshInstagramFollow,
} from "@/module/instagram/hook/useInstagramLink";

type InstagramStatus = NonNullable<
    ReturnType<typeof useInstagramStatus>["data"]
>;

/** Profile recap of the account-wide Instagram link, for a stored account or a player of the open game. */
export function InstagramProfileCard() {
    const { t } = useTranslation();
    const { data } = useInstagramStatus();
    const playing = useCurrentGame().data?.me.participating ?? false;
    useRefreshInstagramFollow();
    const account = data?.link ?? data?.declaration;
    if (!(instagramLink.enabled && (account || playing))) return null;

    return (
        <InfoCard>
            <InfoRow
                icon={InstagramIcon}
                label={
                    account
                        ? `@${account.username}`
                        : t("instagram.profile.label")
                }
                to="/profile/instagram"
                action={data ? <LevelBadge status={data} /> : null}
            />
        </InfoCard>
    );
}

function LevelBadge({ status }: { status: InstagramStatus }) {
    const { t } = useTranslation();
    if (status.link?.follows) {
        return (
            <Badge size="small" variant="success">
                {t("instagram.linked.badge")}
            </Badge>
        );
    }
    if (status.link) {
        return (
            <Badge size="small" variant="warning">
                {t("instagram.profile.notFollowing")}
            </Badge>
        );
    }
    if (status.declaration) {
        return (
            <Badge size="small" variant="info">
                {t("instagram.declare.badge")}
            </Badge>
        );
    }
    return (
        <Badge size="small" variant="neutral">
            {t("instagram.profile.notLinked")}
        </Badge>
    );
}
