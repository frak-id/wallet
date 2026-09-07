import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";
import { routerGenerationOptions } from "../router.options";

/**
 * Writes `app/routeTree.gen.ts`, which is gitignored and normally emitted as a
 * side effect of the vite router plugin. Typecheck needs it without paying for
 * a production build.
 */
const root = fileURLToPath(new URL("..", import.meta.url));

const config = await getConfig(routerGenerationOptions, root);

await new Generator({ config, root }).run();
