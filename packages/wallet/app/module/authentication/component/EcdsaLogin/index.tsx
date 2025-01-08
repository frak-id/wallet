import { usePrivyLogin } from "@/module/authentication/hook/usePrivyLogin";
import { usePrivyContext } from "@/module/common/provider/PrivyProvider";
import { Button } from "@module/component/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Do an ecdsa login, and chain the steps
 *  - If already got a wallet
 * @constructor
 */
export function EcdsaLogin() {
    const { wallet } = usePrivyContext();
    const [currentStep, setCurrentStep] = useState<"email" | "otp" | "siwe">(
        wallet ? "siwe" : "email"
    );
    const [email, setEmail] = useState("");

    return (
        <div className="ecdsa-login">
            {!wallet && currentStep === "email" && (
                <EcdsaSendMail
                    email={email}
                    setEmail={setEmail}
                    onCodeSent={() => setCurrentStep("otp")}
                />
            )}
            {!wallet && currentStep === "otp" && (
                <EcdsaOtp
                    email={email}
                    onBack={() => setCurrentStep("email")}
                    onValidated={() => setCurrentStep("siwe")}
                />
            )}
            {(wallet || currentStep === "siwe") && <EcdsaLoginSiwe />}
        </div>
    );
}

/**
 * Login step where the user need to sign a message to authenticate
 * @constructor
 */
function EcdsaSendMail({
    email,
    setEmail,
    onCodeSent,
}: {
    email: string;
    setEmail: (email: string) => void;
    onCodeSent: () => void;
}) {
    const { t } = useTranslation();
    const { client } = usePrivyContext();
    const { mutate: sendMail, status } = useMutation({
        mutationKey: ["privy", "email-login", "send-code"],
        mutationFn: async (mail: string) => {
            await client.auth.email.sendCode(mail);
        },
        onSuccess: onCodeSent,
    });
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    return (
        <div className="send-mail-container">
            <div className="input-group">
                <label className="input-label" htmlFor={"ecdsa-mail"}>
                    {t("wallet.privyLogin.sendMailInput")}
                </label>
                <input
                    id={"ecdsa-mail"}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="example@email.com"
                    disabled={status === "pending"}
                />
            </div>
            <Button
                type="button"
                onClick={() => sendMail(email)}
                variant="primary"
                disabled={!isValidEmail || status === "pending"}
            >
                {t("wallet.privyLogin.sendMailBtn")}
            </Button>
        </div>
    );
}

/**
 * Login step where the user need to sign a message to authenticate
 * @constructor
 */
function EcdsaOtp({
    email,
    onBack,
    onValidated,
}: {
    email: string;
    onBack: () => void;
    onValidated: () => void;
}) {
    const { t } = useTranslation();
    const { client } = usePrivyContext();
    const [otp, setOtp] = useState("");
    const queryClient = useQueryClient();

    const { mutate: validateOtp, status } = useMutation({
        mutationKey: ["privy", "email-login", "validate-code"],
        mutationFn: async ({
            email,
            code,
        }: { email: string; code: string }) => {
            // Launch otp log in
            await client.auth.email.loginWithCode(
                email,
                code,
                "login-or-sign-up"
            );
            // Invalidate every core queries once logged in
            await queryClient.invalidateQueries({
                queryKey: ["privy-core"],
                exact: false,
            });
        },
        onSuccess: onValidated,
    });

    const handleOtpChange = (value: string) => {
        const sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
        setOtp(sanitizedValue);

        if (sanitizedValue.length === 6) {
            validateOtp({ email, code: sanitizedValue });
        }
    };

    return (
        <div className="otp-container">
            <div className="otp-content">
                <h3 className="otp-title">{t("wallet.privyLogin.otpTitle")}</h3>
                <p className="otp-subtitle">
                    {t("wallet.privyLogin.otpLbl", { email })}
                </p>
                <input
                    type="number"
                    maxLength={6}
                    minLength={6}
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    className="otp-input"
                    placeholder="000000"
                    disabled={status === "pending"}
                />
            </div>
            <button
                onClick={onBack}
                className="change-email-btn"
                type={"button"}
                disabled={status === "pending"}
            >
                Change email
            </button>
        </div>
    );
}

/**
 * Login step where the user need to sign a message to authenticate
 * @constructor
 */
function EcdsaLoginSiwe() {
    const { t } = useTranslation();
    const { privyLogin } = usePrivyLogin();

    return (
        <Button
            type={"button"}
            onClick={() => privyLogin()}
            variant={"primary"}
        >
            {t("wallet.privyLogin.signSiwe")}
        </Button>
    );
}
