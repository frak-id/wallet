import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./campaign-details-sheet.css";
import { BigNumber, MetricCard, TrendLine, useDetailFormatters } from "./parts";

export function EconomicValueCards({
    economicValue,
}: {
    economicValue: CampaignDetailsStats["economicValue"];
}) {
    const { t } = useTranslation();
    const fmt = useDetailFormatters(economicValue.currency);
    const conversions = fmt.integer.format(economicValue.conversions);

    return (
        <div className={styles.twoCol}>
            <MetricCard
                label={t("campaigns.details.economic.yourSpend")}
                descriptor={t("campaigns.details.economic.frakTag")}
                sub={t("campaigns.details.economic.conversionsCpa", {
                    conversions,
                    cpa: fmt.currency.format(economicValue.cpa),
                })}
                footer={
                    <TrendLine trend="down" tone="success">
                        {t("campaigns.details.economic.cheaperThanMeta", {
                            percent: fmt.percent0.format(
                                economicValue.cheaperPct
                            ),
                        })}
                    </TrendLine>
                }
            >
                <BigNumber format={fmt.currency} value={economicValue.spend} />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.economic.equivalentMeta")}
                sub={t("campaigns.details.economic.conversionsCpaMeta", {
                    conversions,
                    cpa: fmt.currency.format(economicValue.metaCpa),
                })}
                footer={
                    <TrendLine trend="up" tone="success">
                        {t("campaigns.details.economic.savedVsMeta", {
                            amount: fmt.currency0.format(
                                economicValue.savedVsMeta
                            ),
                        })}
                    </TrendLine>
                }
            >
                <BigNumber
                    format={fmt.currency0}
                    value={economicValue.metaEquivalentCost}
                />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.economic.attributedGMV")}
                sub={t("campaigns.details.economic.attributedGMVSub")}
            >
                <BigNumber
                    format={fmt.currency0}
                    value={economicValue.attributedGMV}
                />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.economic.avgBasketValue")}
                sub={t("campaigns.details.economic.avgBasketSub")}
            >
                <BigNumber
                    format={fmt.currency}
                    value={economicValue.avgBasketValue}
                />
            </MetricCard>
        </div>
    );
}
