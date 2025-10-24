"use client";

import { type PropsWithChildren, useEffect } from "react";
import { campaignStore } from "@/stores/campaignStore";

/**
 * Campaign create component
 * @param params
 * @constructor
 */
export function CampaignCreate({ children }: PropsWithChildren) {
    const setAction = campaignStore((state) => state.setAction);

    useEffect(() => {
        setAction("create");
    }, [setAction]);

    return children;
}
