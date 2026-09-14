import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "../../tests/vitest-fixtures";
import { FrakConfigProvider } from "../provider/FrakConfigProvider";
import { useFrakConfig } from "./useFrakConfig";

describe("useFrakConfig", () => {
    test("should throw FrakRpcError when used outside provider", () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        expect(() => {
            renderHook(() => useFrakConfig());
        }).toThrow(FrakRpcError);

        try {
            renderHook(() => useFrakConfig());
        } catch (error) {
            expect(error).toBeInstanceOf(FrakRpcError);
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.configError
            );
        }

        consoleErrorSpy.mockRestore();
    });

    test("should return config when used inside provider", ({
        mockFrakConfig,
    }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current.domain).toBe(mockFrakConfig.domain);
        expect(result.current.env).toEqual(mockFrakConfig.env);
        expect(result.current.metadata?.name).toBe(
            mockFrakConfig.metadata?.name
        );
    });
});
