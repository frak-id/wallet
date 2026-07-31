import { ExplorerPhonePreview, previewWrap } from "@frak-labs/ui-preview";
import { useTranslation } from "react-i18next";
import { EditCard } from "@/module/common/component/EditCard";
import { FloatingPhonePreview } from "@/module/common/component/FloatingPhonePreview";
import {
    DetailCell,
    DetailCells,
} from "@/module/merchant/component/DetailCell";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

/**
 * Read-only Explorer presentation for platform admins, who may inspect a
 * merchant's listing but not edit it.
 */
export function ExplorerSummary({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });

    if (!merchant) return null;

    const config = merchant.explorerConfig;
    const enabled = merchant.explorerEnabledAt !== null;

    return (
        <>
            <EditCard title={t("merchantEdit.explorer.title")}>
                <DetailCells>
                    <DetailCell
                        label={t("merchantEdit.explorer.listed")}
                        value={
                            enabled
                                ? t("merchantEdit.explorer.readOnly.listed")
                                : t("merchantEdit.explorer.readOnly.notListed")
                        }
                    />
                    <DetailCell
                        label={t("merchantEdit.explorer.description")}
                        value={config?.description || "—"}
                    />
                </DetailCells>
            </EditCard>
            <FloatingPhonePreview>
                <div
                    className={previewWrap}
                    data-disabled={enabled ? undefined : ""}
                >
                    <ExplorerPhonePreview
                        name={merchant.name}
                        heroImageUrl={config?.heroImageUrl}
                        heroImageUrls={config?.heroImageUrls}
                        logoUrl={config?.logoUrl}
                        description={config?.description}
                    />
                </div>
            </FloatingPhonePreview>
        </>
    );
}
