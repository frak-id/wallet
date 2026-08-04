import { toOpenAPISchema } from "@elysiajs/openapi";

// Importing the route tree builds the domain contexts, and OpenPanel throws
// without this. No request is ever issued, so any non-empty value works.
process.env.OPEN_PANEL_API_URL ??= "https://openapi-generation.invalid";

const { userApi } = await import("../src/api/user");

// `userApi` only: the full app also mounts the business, webhook and legacy
// surfaces, which native SDK authors neither need nor should be handed.
const document = toOpenAPISchema(userApi);

await Bun.write(
    new URL("../user-openapi.json", import.meta.url),
    `${JSON.stringify(document, null, 2)}\n`
);
