import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import type { Campaign } from "@/types/Campaign";

export const publishCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: unknown) => {
        const data = input as { merchantId: string; campaignId: string };
        if (!data.merchantId || !data.campaignId) {
            throw new Error("merchantId and campaignId are required");
        }
        return data;
    })
    .handler(async ({ data }) => {
        const { merchantId, campaignId } = data;

        const { data: response, error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .publish.post();

        if (error || !response) {
            const errorMsg =
                typeof error === "object" && error !== null && "value" in error
                    ? (error as { value: string }).value
                    : "Unknown error";
            throw new Error(`Failed to publish campaign: ${errorMsg}`);
        }

        return response as Campaign;
    });

export const pauseCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: unknown) => {
        const data = input as { merchantId: string; campaignId: string };
        if (!data.merchantId || !data.campaignId) {
            throw new Error("merchantId and campaignId are required");
        }
        return data;
    })
    .handler(async ({ data }) => {
        const { merchantId, campaignId } = data;

        const { data: response, error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .pause.post();

        if (error || !response) {
            const errorMsg =
                typeof error === "object" && error !== null && "value" in error
                    ? (error as { value: string }).value
                    : "Unknown error";
            throw new Error(`Failed to pause campaign: ${errorMsg}`);
        }

        return response as Campaign;
    });

export const resumeCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: unknown) => {
        const data = input as { merchantId: string; campaignId: string };
        if (!data.merchantId || !data.campaignId) {
            throw new Error("merchantId and campaignId are required");
        }
        return data;
    })
    .handler(async ({ data }) => {
        const { merchantId, campaignId } = data;

        const { data: response, error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .resume.post();

        if (error || !response) {
            const errorMsg =
                typeof error === "object" && error !== null && "value" in error
                    ? (error as { value: string }).value
                    : "Unknown error";
            throw new Error(`Failed to resume campaign: ${errorMsg}`);
        }

        return response as Campaign;
    });

export const archiveCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: unknown) => {
        const data = input as { merchantId: string; campaignId: string };
        if (!data.merchantId || !data.campaignId) {
            throw new Error("merchantId and campaignId are required");
        }
        return data;
    })
    .handler(async ({ data }) => {
        const { merchantId, campaignId } = data;

        const { data: response, error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .archive.post();

        if (error || !response) {
            const errorMsg =
                typeof error === "object" && error !== null && "value" in error
                    ? (error as { value: string }).value
                    : "Unknown error";
            throw new Error(`Failed to archive campaign: ${errorMsg}`);
        }

        return response as Campaign;
    });
