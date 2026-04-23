import { useMutation, useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

type MediaUploadInput = {
    merchantId: string;
    image: File;
    type: "logo" | "hero" | "hero-extra";
};

export function useMediaUpload() {
    return useMutation({
        mutationKey: ["media", "upload"],
        mutationFn: async ({ merchantId, image, type }: MediaUploadInput) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                // Eden treaty can't infer union type from dynamic t.Union(map(...))
                .media.upload.post({
                    image,
                    type: type as never,
                });

            if (error) {
                throw error;
            }

            return data;
        },
        onSettled: async (
            _data,
            _error,
            { merchantId },
            _result,
            { client }
        ) => {
            await client.invalidateQueries({
                queryKey: ["media", "list", merchantId],
            });
        },
    });
}

type MediaDeleteInput = {
    merchantId: string;
    // Accepts "logo", "hero", or "hero-{hash}" for slider variants.
    type: string;
};

export function useMediaDelete() {
    return useMutation({
        mutationKey: ["media", "delete"],
        mutationFn: async ({ merchantId, type }: MediaDeleteInput) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .media({ type })
                .delete();

            if (error) {
                throw error;
            }
        },
        onSettled: async (
            _data,
            _error,
            { merchantId },
            _result,
            { client }
        ) => {
            await client.invalidateQueries({
                queryKey: ["media", "list", merchantId],
            });
        },
    });
}

export function useMediaList(merchantId: string) {
    return useQuery({
        queryKey: ["media", "list", merchantId],
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .media.list.get();

            if (error) {
                throw error;
            }

            return data.files;
        },
    });
}
