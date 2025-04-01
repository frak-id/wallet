import { isProd } from "../utils";

/**
 * The base domain name we will use for deployment
 */
export const baseDomainName = isProd ? "gcp.frak.id" : "gcp-dev.frak.id";

/**
 * The domain name we will use for deployment
 */
export const domainName = `backend.${baseDomainName}`;
