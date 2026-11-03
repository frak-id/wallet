import { HttpError } from "@backend-utils";
import { Elysia } from "elysia";
import { MerchantContext } from "../../../domain/merchant";
import { setupCodeFor } from "../../../infrastructure/dns/DnsCheckRepository";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    IdentityLookupQuerySchema,
    IdentityLookupSchema,
    SetupCodeBodySchema,
    SetupCodeResponseSchema,
} from "../../../orchestration/schemas";
import { businessSessionContext } from "../middleware/session";

/** POST so emails stay out of request logs. */
export const internalToolRoutes = new Elysia()
    .use(businessSessionContext)
    .guard({ platformAdminAuthenticated: true })
    .post(
        "/lookup",
        async ({ body }) => {
            const found =
                await OrchestrationContext.orchestrators.identityLookup.lookup(
                    body.q
                );
            if (!found) {
                throw HttpError.notFound(
                    "IDENTITY_NOT_FOUND",
                    "Nobody matches this search"
                );
            }
            return found;
        },
        {
            body: IdentityLookupQuerySchema,
            response: { 200: IdentityLookupSchema },
        }
    )
    .post(
        "/setup-code",
        ({ body }) => {
            const domain =
                MerchantContext.repositories.dnsCheck.getNormalizedDomain(
                    body.domain
                );
            return { domain, setupCode: setupCodeFor(domain, body.owner) };
        },
        {
            body: SetupCodeBodySchema,
            response: { 200: SetupCodeResponseSchema },
        }
    );
