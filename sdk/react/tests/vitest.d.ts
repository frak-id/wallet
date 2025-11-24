/**
 * Type declarations for Vitest + @testing-library/jest-dom
 *
 * This file extends Vitest's Assertion interface to include
 * custom matchers from @testing-library/jest-dom
 */

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

declare module "vitest" {
    interface Assertion<T = unknown>
        extends jest.Matchers<void, T>,
            TestingLibraryMatchers<T, void> {}
}
