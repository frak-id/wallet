/**
 * Re-declares the jest-dom matchers on Vitest's `Assertion` interface.
 *
 * `@testing-library/jest-dom/vitest` ships `interface Assertion<T = any>`, but
 * Vitest 5 widened it to `Assertion<R, T>` where `R` is the matcher return
 * type. The arities differ, so the upstream declaration no longer merges and
 * every `toBeInTheDocument()` / `toHaveAttribute()` fails to typecheck. Only
 * the types are affected — `expect.extend` still registers the matchers, so
 * the assertions themselves run correctly.
 *
 * `TestingLibraryMatchers<E, R>` takes the matcher return type second, so
 * Vitest's `R` is threaded there.
 *
 * Delete once jest-dom publishes the two-parameter form.
 * Tracked upstream: testing-library/jest-dom#738.
 */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

declare module "vitest" {
    interface Assertion<R = void, T = unknown>
        extends TestingLibraryMatchers<unknown, R> {}
    interface AsymmetricMatchersContaining
        extends TestingLibraryMatchers<unknown, unknown> {}
}
