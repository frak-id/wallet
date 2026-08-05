import { toOpenAPISchema } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import {
    CONDITION_GROUP_SCHEMA_ID,
    ConditionGroupSchema,
} from "../src/domain/campaign/schemas";

// Importing the route tree builds the domain contexts, and OpenPanel throws
// without this. No request is ever issued, so any non-empty value works.
process.env.OPEN_PANEL_API_URL ??= "https://openapi-generation.invalid";

// Dynamic: the route tree must not be imported before OPEN_PANEL_API_URL is set.
const { userApi } = await import("../src/api/user");

const packageJson = (await Bun.file(
    new URL("../package.json", import.meta.url)
).json()) as { version?: string };

// @elysiajs/openapi 1.4.x hardcodes 3.0.3 in its own `toFullSchema`, but what it
// actually emits is 3.1 JSON Schema: 160 `const` keywords and 6
// `patternProperties` in this document, neither of which is legal in 3.0. Only a
// single stray `nullable` (on an affiliate route) is 3.0-only.
//
// Declaring 3.0.3 is therefore the misdescription, not 3.1. It also has teeth:
// against a real validator the 3.0 claim produces 155 spurious `Property
// \`const\` is not expected here` errors, which is exactly the kind of noise that
// makes a spec get written off as unusable for codegen.
const OPENAPI_VERSION = "3.1.0";

// `userApi` only: the full app also mounts the business, webhook and legacy
// surfaces, which native SDK authors neither need nor should be handed.
//
// The recursive ConditionGroup schema self-references by `$id`. Registering it
// as an Elysia model is what puts the definition under `components.schemas`,
// so those refs resolve instead of dangling (see domain/campaign/schemas).
const app = new Elysia()
    .model({ [CONDITION_GROUP_SCHEMA_ID]: ConditionGroupSchema })
    .use(userApi);

const { components, paths } = toOpenAPISchema(app);

const document = {
    openapi: OPENAPI_VERSION,
    info: {
        title: "Frak User API",
        version: packageJson.version ?? "0.0.0",
        description:
            "User-facing Frak API consumed by the native SDKs (iOS and Android). Covers wallet sessions, interactions tracking, merchant information and reward estimation.",
    },
    servers: [
        // Production is the GCP cluster ingress (infra/gcp/backend.ts keeps
        // `backend.frak.id` as the legacy AWS-era hostname, now pointed at the
        // same GCP service — infra/config.ts resolves `backendUrl` to it for
        // the prod stage), so there is a single production origin.
        { url: "https://backend.frak.id", description: "Production" },
        {
            url: "https://backend.gcp-dev.frak.id",
            description: "Development",
        },
    ],
    paths,
    components: {
        ...components,
        securitySchemes: {
            // Header names verified against src/api/user/track/sdkIdentity.ts
            // and src/infrastructure/macro/session.ts.
            frakClientId: {
                type: "apiKey",
                in: "header",
                name: "x-frak-client-id",
                description:
                    "Merchant/client identifier sent by the SDK on tracking calls.",
            },
            walletSdkAuth: {
                type: "apiKey",
                in: "header",
                name: "x-wallet-sdk-auth",
                description:
                    "Signed SDK wallet session token, used to attribute a caller to a wallet.",
            },
            walletAuth: {
                type: "apiKey",
                in: "header",
                name: "x-wallet-auth",
                description:
                    "Full wallet session token. Takes precedence over x-wallet-sdk-auth when it verifies.",
            },
        },
    },
};

await Bun.write(
    new URL("../user-openapi.json", import.meta.url),
    `${JSON.stringify(document, null, 2)}\n`
);
