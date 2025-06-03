import { useGetOnChainCampaignDetails } from "@/module/campaigns/hook/useGetOnChainDetails";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { format } from "date-fns";
import { useMemo } from "react";
import type { Address } from "viem";

/**
 * Display the campaign dates
 * @param campaignAddress
 * @constructor
 */
export function CampaignDates({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    const { data: onChainInfos, isLoading } = useGetOnChainCampaignDetails({
        campaignAddress,
    });

    const { start, end } = useMemo(() => {
        if (!onChainInfos) return { start: "Not set", end: "Not set" };

        const dateStart = new Date(onChainInfos.config[1].start * 1000);
        const dateEnd = onChainInfos.config[1].end
            ? new Date(onChainInfos.config[1].end * 1000)
            : undefined;

        return {
            start: dateStart ? format(dateStart, "PPP") : "Not set",
            end: dateEnd ? format(dateEnd, "PPP") : "Not set",
        };
    }, [onChainInfos]);

    if (isLoading) {
        return null;
    }

    return (
        <>
            <Title as={"h3"} size={"small"}>
                Dates
            </Title>
            <Row>From: {start}</Row>
            <Row>To: {end}</Row>
        </>
    );
}
