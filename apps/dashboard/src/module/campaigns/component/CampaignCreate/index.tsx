"use client";

import { campaignActionAtom } from "@/module/campaigns/atoms/campaign";
import { useSetAtom } from "jotai";
import { type PropsWithChildren, useEffect } from "react";

/**
 * Campaign create component
 * @param params
 * @constructor
 */
export function CampaignCreate({ children }: PropsWithChildren) {
    const setCampaignAction = useSetAtom(campaignActionAtom);

    useEffect(() => {
        setCampaignAction("create");
    }, [setCampaignAction]);

    return children;
}
