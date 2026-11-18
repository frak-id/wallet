type Bag = Record<string, unknown>;

const PARAMS_LINE = /\nparams: .*/g;
const REDACTED_PARAMS = "\nparams: [redacted]";
const FAILING_ROW = "Failing row contains";

function isErrorLike(value: unknown): value is Bag {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Bag).message === "string"
    );
}

function redactText(text: string): string {
    return text.includes("\nparams: ")
        ? text.replace(PARAMS_LINE, REDACTED_PARAMS)
        : text;
}

function redactStringField(target: Bag, key: string, exact?: string): void {
    const value = target[key];
    if (typeof value !== "string") return;
    const scrubbed = redactText(
        exact ? value.replace(exact, REDACTED_PARAMS) : value
    );
    // Reflect.set: a frozen error must not turn a log call into a throw
    if (scrubbed !== value) Reflect.set(target, key, scrubbed);
}

function redactError(error: Bag, seen: Set<unknown>): void {
    if (seen.has(error)) return;
    seen.add(error);

    // DrizzleQueryError: `params` holds the bound values, its message and stack repeat them
    const exact =
        typeof error.query === "string" && Array.isArray(error.params)
            ? `\nparams: ${String(error.params)}`
            : undefined;
    redactStringField(error, "message", exact);
    redactStringField(error, "stack", exact);
    if (exact) Reflect.deleteProperty(error, "params");

    // Postgres echoes the whole row on NOT NULL / CHECK violations
    if (
        typeof error.detail === "string" &&
        error.detail.startsWith(FAILING_ROW)
    ) {
        Reflect.set(error, "detail", `${FAILING_ROW} [redacted]`);
    }

    if (isErrorLike(error.cause)) redactError(error.cause, seen);
    if (Array.isArray(error.errors)) {
        for (const inner of error.errors) {
            if (isErrorLike(inner)) redactError(inner, seen);
        }
    }
}

/**
 * Strips SQL bound values from pino log arguments, in place, before they are serialized:
 * errors anywhere in a cause chain, and strings that already embed such an error's message.
 * Meant for a pino `hooks.logMethod`.
 */
export function redactQueryParams(args: unknown[]): void {
    const seen = new Set<unknown>();
    for (const [index, arg] of args.entries()) {
        if (typeof arg === "string") {
            args[index] = redactText(arg);
            continue;
        }
        if (typeof arg !== "object" || arg === null) continue;
        if (isErrorLike(arg)) redactError(arg, seen);

        // Data properties only: an accessor (Elysia's context has some) is never invoked
        const bag = arg as Bag;
        for (const [key, descriptor] of Object.entries(
            Object.getOwnPropertyDescriptors(arg)
        )) {
            if (typeof descriptor.value === "string") {
                redactStringField(bag, key);
            } else if (isErrorLike(descriptor.value)) {
                redactError(descriptor.value, seen);
            }
        }
    }
}
