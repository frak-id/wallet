"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { type Address, type Hex, isAddress, keccak256, toHex } from "viem";
import type { Campaign } from "../../../../types/Campaign";

export function extractSearchParams() {
    const searchParams = useSearchParams();
    return useMemo(() => {
        // Params:
        // - name, bank id, domain, weekly budget, cac brut, ratio
        const name = searchParams?.get("n");
        const bankId = searchParams?.get("bid");
        const domain = searchParams?.get("d");
        const weeklyBudget = searchParams?.get("wb");
        const cacBrut = searchParams?.get("cac");
        const ratio = searchParams?.get("r");

        if (
            !name ||
            !bankId ||
            !domain ||
            !weeklyBudget ||
            !cacBrut ||
            !ratio
        ) {
            throw new Error("Missing required parameters");
        }
        if (!isAddress(bankId)) {
            throw new Error("Invalid bank id");
        }

        if (Number.isNaN(Number(weeklyBudget))) {
            throw new Error("Invalid weekly budget");
        }

        if (Number.isNaN(Number(cacBrut))) {
            throw new Error("Invalid cac brut");
        }

        if (Number.isNaN(Number(ratio))) {
            throw new Error("Invalid ratio");
        }

        // Compute product id
        const productId = keccak256(toHex(domain.replace("www.", "")));

        return {
            name,
            bankId,
            domain,
            weeklyBudget: Number(weeklyBudget),
            cacBrut: Number(cacBrut),
            ratio: Number(ratio),
            productId,
        };
    }, [searchParams]);
}

export function createCampaignDraft({
    name,
    bankId,
    productId,
    weeklyBudget,
    cacBrut,
    ratio,
}: {
    name: string;
    bankId: Address;
    productId: Hex;
    weeklyBudget: number;
    cacBrut: number;
    ratio: number;
}) {
    const campaign: Campaign = {
        title: name,
        productId: productId,
        type: "sales", // always sales for shopify embedded campaign
        specialCategories: [],
        budget: {
            type: "weekly",
            maxEuroDaily: weeklyBudget,
        },
        territories: ["FR", "BE", "SH", "GB", "US"], // Wide coverage for simplified setup
        bank: bankId,
        scheduled: {
            dateStart: new Date(),
        },
        rewardChaining: {
            userPercent: 1 - ratio / 100,
        },
        triggers: {
            started: {
                cac: cacBrut,
            },
        },
        // On shopify we directly use the token symbol for the setup
        setupCurrency: "raw",
    };

    return campaign;
}
