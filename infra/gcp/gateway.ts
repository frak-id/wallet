import type { EdgeTraffic } from "../components/KubernetesService";
import { isProd, normalizedStageName } from "../utils";
import { baseDomainName, walletNamespace } from "./utils";

// Shared Envoy Gateway, owned by frak-id/infra-core
const gatewayRef = { name: "frak-gateway", namespace: "networking" };
const gatewayHttpsParentRef = { ...gatewayRef, sectionName: "https" };

/**
 * Route53 host of each app. The Gateway's wildcard certs only cover the gcp
 * zones, so each of these gets its own listener + cert (ListenerSet below),
 * issued over DNS-01 through its `_acme-challenge` CNAME before any DNS flip.
 */
const vanityHosts = {
    wallet: isProd ? "wallet.frak.id" : "wallet-dev.frak.id",
    backend: isProd ? "backend.frak.id" : "backend-dev.frak.id",
    business: isProd ? "business.frak.id" : "business-dev.frak.id",
    shopify: isProd ? "extension-shop.frak.id" : "extension-shop-dev.frak.id",
};

const listenerSetName = `wallet-${normalizedStageName}`;

// Bun closes keep-alive connections idle for 30s (services/backend/src/index.ts)
export const backendUpstreamTraffic: EdgeTraffic = {
    connectionIdleTimeout: "25s",
    streamIdleTimeout: "30s",
};

/**
 * HTTPRoute hostnames + parents for an app: its Route53 host, its gcp alias,
 * and the `<sub>.gw.<zone>` shadow host, which resolves to the Gateway today.
 */
export function gatewayRoute(app: keyof typeof vanityHosts, gcpSub: string) {
    return {
        hostnames: [
            vanityHosts[app],
            `${gcpSub}.${baseDomainName}`,
            `${gcpSub}.gw.${baseDomainName}`,
        ],
        parentRefs: [
            gatewayHttpsParentRef,
            {
                group: "gateway.networking.k8s.io",
                kind: "ListenerSet",
                name: listenerSetName,
                sectionName: app,
            },
        ],
    };
}

if (!$dev) {
    const listeners = Object.entries(vanityHosts).map(([app, hostname]) => {
        const secretName = `${app}-gateway-tls`;
        new kubernetes.apiextensions.CustomResource(
            `gateway-${app}-certificate`,
            {
                apiVersion: "cert-manager.io/v1",
                kind: "Certificate",
                metadata: {
                    name: `${app}-gateway`,
                    namespace: walletNamespace.metadata.name,
                    // Selects infra-core's delegated DNS-01 solver
                    labels: { "frak.id/acme-solver": "dns01-delegated" },
                },
                spec: {
                    secretName,
                    // Never a gcp alias: a SAN overlapping the Gateway
                    // wildcards drops every :443 listener to HTTP/1.1
                    dnsNames: [hostname],
                    issuerRef: {
                        kind: "ClusterIssuer",
                        name: "letsencrypt-v2",
                    },
                    privateKey: { algorithm: "ECDSA", size: 256 },
                },
            }
        );
        return {
            name: app,
            hostname,
            port: 443,
            protocol: "HTTPS",
            tls: {
                mode: "Terminate",
                certificateRefs: [{ kind: "Secret", name: secretName }],
            },
            allowedRoutes: { namespaces: { from: "Same" } },
        };
    });

    new kubernetes.apiextensions.CustomResource("gateway-vanity-listeners", {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "ListenerSet",
        metadata: {
            name: listenerSetName,
            namespace: walletNamespace.metadata.name,
        },
        spec: {
            parentRef: {
                group: "gateway.networking.k8s.io",
                kind: "Gateway",
                ...gatewayRef,
            },
            listeners,
        },
    });
}
