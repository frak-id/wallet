import type { AuthenticatedContext } from "../types/context";
import { log } from "./logger";

type GraphQLBody<TData> = {
    data?: TData;
    errors?: Array<{ message: string }>;
};

/** One Admin GraphQL call: `null`, logged under `label`, when it throws or returns top-level errors. */
export async function runAdminGraphql<TData>(
    context: AuthenticatedContext,
    label: string,
    query: string,
    variables: Record<string, unknown> = {}
): Promise<TData | null> {
    try {
        const response = await context.admin.graphql(query, { variables });
        const body = (await response.json()) as GraphQLBody<TData>;
        if (body.errors?.length) {
            log.error({ label, errors: body.errors }, "admin graphql errors");
            return null;
        }
        return body.data ?? null;
    } catch (err) {
        log.error({ err, label }, "admin graphql request failed");
        return null;
    }
}
