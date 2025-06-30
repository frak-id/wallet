"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { type Address, type Hex, isAddress, keccak256, toHex } from "viem";
import type { Campaign } from "../../../../types/Campaign";

function getBudget({
    weeklyBudget,
    monthlyBudget,
    globalBudget,
}: {
    weeklyBudget: string | null;
    monthlyBudget: string | null;
    globalBudget: string | null;
}): Campaign["budget"] {
    // Check each budget
    if (weeklyBudget && Number.isNaN(Number(weeklyBudget))) {
        throw new Error("Invalid weekly budget");
    }

    if (monthlyBudget && Number.isNaN(Number(monthlyBudget))) {
        throw new Error("Invalid monthly budget");
    }

    if (globalBudget && Number.isNaN(Number(globalBudget))) {
        throw new Error("Invalid global budget");
    }

    // Count how many budgets are provided and ensure exactly one
    const budgetCount = [weeklyBudget, monthlyBudget, globalBudget].filter(
        Boolean
    ).length;

    if (budgetCount === 0) {
        throw new Error("Missing required parameters");
    }

    if (budgetCount > 1) {
        throw new Error("Only one budget can be provided");
    }

    if (weeklyBudget) {
        return {
            type: "weekly",
            maxEuroDaily: Number(weeklyBudget),
        };
    }

    if (monthlyBudget) {
        return {
            type: "monthly",
            maxEuroDaily: Number(monthlyBudget),
        };
    }

    return {
        type: "global",
        maxEuroDaily: Number(globalBudget),
    };
}

export function extractSearchParams() {
    const searchParams = useSearchParams();
    return useMemo(() => {
        // Params:
        // - name, bank id, domain, weekly budget, cac brut, ratio
        const name = searchParams?.get("n");
        const bankId = searchParams?.get("bid");
        const domain = searchParams?.get("d");
        const cacBrut = searchParams?.get("cac");
        const ratio = searchParams?.get("r");
        const setupCurrency = searchParams?.get("sc");
        // Budget props
        const weeklyBudget = searchParams?.get("wb");
        const monthlyBudget = searchParams?.get("mb");
        const globalBudget = searchParams?.get("gb");

        if (!name || !bankId || !domain || !cacBrut || !ratio) {
            throw new Error("Missing required parameters");
        }
        if (!isAddress(bankId)) {
            throw new Error("Invalid bank id");
        }

        if (Number.isNaN(Number(cacBrut))) {
            throw new Error("Invalid cac brut");
        }

        if (Number.isNaN(Number(ratio))) {
            throw new Error("Invalid ratio");
        }

        if (
            setupCurrency &&
            !["eur", "usd", "gbp", "raw"].includes(setupCurrency)
        ) {
            throw new Error("Invalid setup currency");
        }

        // Compute product id
        const productId = keccak256(toHex(domain.replace("www.", "")));

        return {
            name,
            bankId,
            domain,
            budget: getBudget({
                weeklyBudget,
                monthlyBudget,
                globalBudget,
            }),
            cacBrut: Number(cacBrut),
            ratio: Number(ratio),
            productId,
            setupCurrency: setupCurrency as
                | "eur"
                | "usd"
                | "gbp"
                | "raw"
                | undefined,
        };
    }, [searchParams]);
}

export function createCampaignDraft({
    name,
    bankId,
    productId,
    budget,
    cacBrut,
    ratio,
    setupCurrency,
}: {
    name: string;
    bankId: Address;
    productId: Hex;
    budget: Campaign["budget"];
    cacBrut: number;
    ratio: number;
    setupCurrency?: "eur" | "usd" | "gbp" | "raw";
}) {
    const campaign: Campaign = {
        title: name,
        productId: productId,
        type: "sales", // always sales for shopify embedded campaign
        specialCategories: [],
        budget,
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
        setupCurrency: setupCurrency ?? "raw",
    };

    return campaign;
}
