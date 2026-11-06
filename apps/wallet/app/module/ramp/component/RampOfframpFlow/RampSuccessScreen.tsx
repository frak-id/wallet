import { formatCurrency } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { SheetScreen } from "@/module/common/component/SheetScreen";
import { rampFlowStore, selectSale } from "@/module/ramp/store/rampFlowStore";

/** Step 4: the USDC is sent; Ramp pays out and emails the user. */
export function RampSuccessScreen({ onClose }: { onClose: () => void }) {
    const { t, i18n } = useTranslation();
    const sale = rampFlowStore(selectSale);

    return (
        <SheetScreen
            onClose={onClose}
            title={t("ramp.flow.success.title")}
            description={
                sale
                    ? t("ramp.flow.success.description", {
                          amount: formatCurrency(
                              sale.fiatAmount,
                              sale.fiatCurrency,
                              i18n.language
                          ),
                      })
                    : t("ramp.flow.success.descriptionNoSale")
            }
            ctaLabel={t("ramp.flow.success.cta")}
            ctaOnClick={onClose}
        />
    );
}
