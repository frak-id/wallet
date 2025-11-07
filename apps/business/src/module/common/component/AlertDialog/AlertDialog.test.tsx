/**
 * NOTE: This test is temporarily disabled due to a rolldown parse error
 * when transforming AlertDialog component from @frak-labs/ui. The error occurs
 * during the build/transform phase before tests run, preventing the test from executing.
 *
 * AlertDialog is a thin wrapper around @frak-labs/ui AlertDialog that adds
 * custom className props. The component logic is straightforward and can be
 * tested manually or via integration tests.
 *
 * TODO: Re-enable when rolldown parse issue is resolved or when using
 * a different build tool that handles the AlertDialog component correctly.
 */

import { describe } from "vitest";

describe.skip("AlertDialog", () => {
    it.todo("should render children");
    it.todo("should apply content className");
    it.todo("should apply title className");
    it.todo("should pass through props");
});
