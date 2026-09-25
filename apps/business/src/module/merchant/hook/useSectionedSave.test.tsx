import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mediaUploadMutationKey } from "./useMediaUpload";
import { useSectionedSave } from "./useSectionedSave";

describe("useSectionedSave", () => {
    it("reports saving while an image upload is running", async () => {
        const client = new QueryClient();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
        const { result } = renderHook(() => useSectionedSave(), { wrapper });
        expect(result.current.isSaving).toBe(false);

        let finish = () => {};
        act(() => {
            void client
                .getMutationCache()
                .build(client, {
                    mutationKey: mediaUploadMutationKey,
                    mutationFn: () =>
                        new Promise<void>((resolve) => {
                            finish = resolve;
                        }),
                })
                .execute(undefined);
        });
        await waitFor(() => expect(result.current.isSaving).toBe(true));

        act(() => finish());
        await waitFor(() => expect(result.current.isSaving).toBe(false));
    });
});
