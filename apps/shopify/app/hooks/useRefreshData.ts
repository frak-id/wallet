"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRevalidator } from "react-router";

export function useRefreshData() {
    const { revalidate } = useRevalidator();
    const queryClient = useQueryClient();

    return useCallback(async () => {
        await queryClient.refetchQueries();
        await revalidate();
    }, [revalidate, queryClient]);
}
