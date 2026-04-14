import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

type MediaUploadInput = {
    merchantId: string;
    image: File;
    type: "logo" | "hero";
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
    });
}

type MediaDeleteInput = {
    merchantId: string;
    type: "logo" | "hero";
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
    });
}
