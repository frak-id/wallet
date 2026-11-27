import { render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { toAuthError } from "@/module/auth/utils/authError";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
}));

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));
const idle = { mutate: vi.fn(), isPending: false, error: null };
vi.mock("@/module/auth/hooks/useEmailAuth", () => ({
    usePasswordLogin: () => mockLogin(),
    useRegisterAccount: () => idle,
    useRequestPasswordReset: () => idle,
    useConfirmPasswordReset: () => idle,
}));

import { EmailPanel } from "./EmailPanel";

describe("EmailPanel login errors", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test.each([
        [401, "auth.login.email.loginError"],
        [503, "errors.auth.unavailable"],
        [500, "errors.auth.unavailable"],
        [429, "errors.auth.unavailable"],
    ])("a login failing with %i shows %s", (status, message) => {
        mockLogin.mockReturnValue({
            ...idle,
            error: toAuthError({ status, value: "Backend text" }, "x"),
        });

        render(<EmailPanel />);

        expect(screen.getByText(message)).toBeInTheDocument();
    });
});
