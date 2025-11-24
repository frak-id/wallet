/**
 * Tests for FrakConfigProvider
 * Tests that the provider correctly provides config to child components
 */

import { render } from "@testing-library/react";
import React, { createElement } from "react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { FrakConfigContext, FrakConfigProvider } from "./FrakConfigProvider";

describe("FrakConfigProvider", () => {
    test("should render children", ({ mockFrakConfig }) => {
        const { container } = render(
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement("div", { "data-testid": "child" }, "Test Child")
            )
        );

        expect(
            container.querySelector('[data-testid="child"]')
        ).toBeInTheDocument();
        expect(container.textContent).toContain("Test Child");
    });

    test("should provide config to context consumers", ({ mockFrakConfig }) => {
        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement(Consumer)
            )
        );

        expect(receivedConfig).toBeDefined();
        expect(receivedConfig.domain).toBe(mockFrakConfig.domain);
    });

    test("should apply default walletUrl", () => {
        const configWithoutWalletUrl = {
            domain: "example.com",
            metadata: {
                name: "Test App",
            },
        };

        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: configWithoutWalletUrl },
                createElement(Consumer)
            )
        );

        expect(receivedConfig.walletUrl).toBe("https://wallet.frak.id");
    });

    test("should preserve custom walletUrl", ({ mockFrakConfig }) => {
        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement(Consumer)
            )
        );

        expect(receivedConfig.walletUrl).toBe(mockFrakConfig.walletUrl);
    });

    test("should fallback domain to window.location.host", () => {
        const configWithoutDomain = {
            metadata: {
                name: "Test App",
            },
        };

        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: configWithoutDomain as any },
                createElement(Consumer)
            )
        );

        // In test environment, window.location.host is "localhost:3000" (JSDOM default)
        expect(receivedConfig.domain).toBe(window.location.host);
    });

    test("should pass through all config properties", ({ mockFrakConfig }) => {
        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement(Consumer)
            )
        );

        expect(receivedConfig.domain).toBe(mockFrakConfig.domain);
        expect(receivedConfig.walletUrl).toBe(mockFrakConfig.walletUrl);
        expect(receivedConfig.metadata).toEqual(mockFrakConfig.metadata);
        expect(receivedConfig.customizations).toEqual(
            mockFrakConfig.customizations
        );
    });

    test("should handle minimal config", () => {
        const minimalConfig = {
            domain: "minimal.com",
            metadata: {
                name: "Minimal Test App",
            },
        };

        let receivedConfig: any;

        const Consumer = () => {
            const config = React.useContext(FrakConfigContext);
            receivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: minimalConfig },
                createElement(Consumer)
            )
        );

        expect(receivedConfig.domain).toBe("minimal.com");
        expect(receivedConfig.walletUrl).toBe("https://wallet.frak.id");
        expect(receivedConfig.metadata.name).toBe("Minimal Test App");
    });

    test("should support nested providers with different configs", () => {
        const outerConfig = {
            domain: "outer.com",
            walletUrl: "https://wallet-outer.frak.id",
            metadata: {
                name: "Outer App",
            },
        };

        const innerConfig = {
            domain: "inner.com",
            walletUrl: "https://wallet-inner.frak.id",
            metadata: {
                name: "Inner App",
            },
        };

        let outerReceivedConfig: any;
        let innerReceivedConfig: any;

        const OuterConsumer = () => {
            const config = React.useContext(FrakConfigContext);
            outerReceivedConfig = config;
            return null;
        };

        const InnerConsumer = () => {
            const config = React.useContext(FrakConfigContext);
            innerReceivedConfig = config;
            return null;
        };

        render(
            createElement(
                FrakConfigProvider,
                { config: outerConfig },
                createElement(OuterConsumer),
                createElement(
                    FrakConfigProvider,
                    { config: innerConfig },
                    createElement(InnerConsumer)
                )
            )
        );

        expect(outerReceivedConfig.domain).toBe("outer.com");
        expect(innerReceivedConfig.domain).toBe("inner.com");
    });

    test("should render multiple children", ({ mockFrakConfig }) => {
        const { container } = render(
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement("div", { "data-testid": "child1" }, "Child 1"),
                createElement("div", { "data-testid": "child2" }, "Child 2"),
                createElement("div", { "data-testid": "child3" }, "Child 3")
            )
        );

        expect(
            container.querySelector('[data-testid="child1"]')
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="child2"]')
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="child3"]')
        ).toBeInTheDocument();
    });
});
