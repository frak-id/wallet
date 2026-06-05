import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Same relative path the service imports (not the alias, which won't resolve here).
import { buildRecoveryEmail } from "../../../infrastructure/integrations/email";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { RecoveryRepository } from "../repositories/RecoveryRepository";
import type { EmailSender } from "./EmailSender";
import { RecoveryEmailService } from "./RecoveryEmailService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../infrastructure/integrations/email", () => ({
    buildRecoveryEmail: vi.fn(() => ({
        subject: "Recover your wallet",
        html: "<html></html>",
    })),
}));

const GROUP_ID = "group-1";
const EMAIL = "user@test.com";

const createIdentityRepository = () =>
    ({ findEmailNode: vi.fn() }) as unknown as IdentityRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const createRecoveryRepository = () =>
    ({ findByGroup: vi.fn() }) as unknown as RecoveryRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const createEmailSender = () =>
    ({ send: vi.fn(async () => ({ id: "msg-1" })) }) as unknown as EmailSender &
        Record<string, ReturnType<typeof vi.fn>>;

const verifiedEmailNode = () => ({
    groupId: GROUP_ID,
    identityValue: EMAIL,
    identityType: "email" as const,
    unlinkedAt: null,
    verifiedAt: new Date(),
});

// The service awaits a fixed 500ms throttle before doing any work, so each call
// is driven to completion by flushing fake timers + the microtasks behind them.
const runRequest = async (service: RecoveryEmailService, email: string) => {
    const promise = service.requestRecoveryEmail(email);
    await vi.runAllTimersAsync();
    await promise;
};

describe("RecoveryEmailService", () => {
    let identityRepository: ReturnType<typeof createIdentityRepository>;
    let recoveryRepository: ReturnType<typeof createRecoveryRepository>;
    let emailSender: ReturnType<typeof createEmailSender>;
    let service: RecoveryEmailService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(buildRecoveryEmail).mockClear();
        process.env.FRAK_WALLET_URL = "https://wallet.test";
        identityRepository = createIdentityRepository();
        recoveryRepository = createRecoveryRepository();
        emailSender = createEmailSender();
        service = new RecoveryEmailService(
            identityRepository as unknown as IdentityRepository,
            recoveryRepository as unknown as RecoveryRepository,
            emailSender as unknown as EmailSender
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("mails the blob + deeplink when the email is verified and recoverable", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue({ blob: "blob-xyz" });

        await runRequest(service, EMAIL);

        expect(buildRecoveryEmail).toHaveBeenCalledWith({
            blob: "blob-xyz",
            link: "https://wallet.test/recovery#blob=blob-xyz",
        });
        expect(emailSender.send).toHaveBeenCalledWith(
            expect.objectContaining({ to: EMAIL })
        );
    });

    it("no-ops when the email has no identity node", async () => {
        identityRepository.findEmailNode.mockResolvedValue(null);

        await runRequest(service, EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("no-ops when the email node is unlinked (retired)", async () => {
        identityRepository.findEmailNode.mockResolvedValue({
            ...verifiedEmailNode(),
            unlinkedAt: new Date(),
        });

        await runRequest(service, EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("no-ops when the email node is not verified", async () => {
        identityRepository.findEmailNode.mockResolvedValue({
            ...verifiedEmailNode(),
            verifiedAt: null,
        });

        await runRequest(service, EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("no-ops when the group has no stored recovery blob", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue(null);

        await runRequest(service, EMAIL);

        expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("swallows send failures so existence is never leaked", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue({ blob: "blob-xyz" });
        emailSender.send.mockRejectedValue(new Error("resend down"));

        await expect(runRequest(service, EMAIL)).resolves.toBeUndefined();
    });
});
