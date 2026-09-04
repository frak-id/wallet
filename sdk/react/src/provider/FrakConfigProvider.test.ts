/**
 * Tests for FrakConfigProvider
 * Tests that the provider correctly provides config to child components
 */

import { getEnvironment, setEnvironment } from "@frak-labs/core-sdk";
import { render } from "@testing-library/react";
import React, { createElement } from "react";
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../tests/vitest-fixtures";
import { FrakConfigContext, FrakConfigProvider } from "./FrakConfigProvider";

describe("FrakConfigProvider", () => {
    beforeEach(() => {
        // The env is a page-level singleton and a config without `env` leaves
        // whatever was published alone, so each case has to state its own.
        setEnvironment("prod");
    });
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

    test("should leave the published environment alone when none is given", () => {
        setEnvironment("dev");

        render(
            createElement(FrakConfigProvider, {
                config: { domain: "example.com", metadata: { name: "Test" } },
            })
        );

        // Not "reset to prod": a bare config must not repoint an SDK that
        // another integration on the page already pointed at a stage.
        expect(getEnvironment()).toEqual({
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        });
    });

    test("nested providers: the last one to mount wins globally", () => {
        // Documents the singleton's cost: `env` is page-level, so unlike every
        // other config field it is NOT scoped to the provider subtree.
        render(
            createElement(
                FrakConfigProvider,
                { config: { env: "prod" as const, metadata: { name: "O" } } },
                createElement(FrakConfigProvider, {
                    config: { env: "dev" as const, metadata: { name: "I" } },
                })
            )
        );

        expect(getEnvironment().backend).toBe(
            "https://backend.gcp-dev.frak.id"
        );
    });

    test("should publish the configured environment", ({ mockFrakConfig }) => {
        render(createElement(FrakConfigProvider, { config: mockFrakConfig }));

        expect(getEnvironment()).toEqual(mockFrakConfig.env);
    });

    test("should publish the named dev environment", () => {
        render(
            createElement(FrakConfigProvider, {
                config: {
                    domain: "example.com",
                    env: "dev",
                    metadata: { name: "Test App" },
                },
            })
        );

        expect(getEnvironment()).toEqual({
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        });
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
        expect(receivedConfig.env).toEqual(mockFrakConfig.env);
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
        expect(receivedConfig.metadata.name).toBe("Minimal Test App");
    });

    test("should support nested providers with different configs", () => {
        const outerConfig = {
            domain: "outer.com",
            metadata: {
                name: "Outer App",
            },
        };

        const innerConfig = {
            domain: "inner.com",
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
