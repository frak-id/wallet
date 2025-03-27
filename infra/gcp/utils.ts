import { isProd } from "../utils";

// Create a dedicated namespace for backend
export const backendNamespace = new kubernetes.core.v1.Namespace(
    "infra-wallet",
    {
        metadata: { name: "infra-wallet" },
    }
);

/**
 * The base domain name we will use for deployment
 */
export const baseDomainName = isProd ? "gcp.frak.id" : "gcp-dev.frak.id";

/**
 * The domain name we will use for deployment
 */
export const domainName = `backend.${baseDomainName}`;
