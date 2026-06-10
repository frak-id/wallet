import { beforeEach, describe, expect, it, vi } from "vitest";
// Same relative path the service imports (not the alias, which won't resolve here).
import {
    buildRecoveryEmail,
    resendClient,
} from "../../../infrastructure/integrations/email";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { RecoveryRepository } from "../repositories/RecoveryRepository";
import { RecoveryEmailService } from "./RecoveryEmailService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../infrastructure/integrations/email", () => ({
    buildRecoveryEmail: vi.fn(() => ({
        subject: "Recover your wallet",
        html: "<html></html>",
    })),
    resendClient: { send: vi.fn() },
}));

const GROUP_ID = "group-1";
const EMAIL = "user@test.com";

const createIdentityRepository = () =>
    ({ findEmailNode: vi.fn() }) as unknown as IdentityRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const createRecoveryRepository = () =>
    ({ findByGroup: vi.fn() }) as unknown as RecoveryRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const verifiedEmailNode = () => ({
    groupId: GROUP_ID,
    identityValue: EMAIL,
    identityType: "email" as const,
    unlinkedAt: null,
    verifiedAt: new Date(),
});

describe("RecoveryEmailService", () => {
    let identityRepository: ReturnType<typeof createIdentityRepository>;
    let recoveryRepository: ReturnType<typeof createRecoveryRepository>;
    let service: RecoveryEmailService;

    beforeEach(() => {
        vi.mocked(buildRecoveryEmail).mockClear();
        vi.mocked(resendClient.send).mockReset().mockResolvedValue({
            id: "msg-1",
        });
        process.env.FRAK_WALLET_URL = "https://wallet.test";
        identityRepository = createIdentityRepository();
        recoveryRepository = createRecoveryRepository();
        service = new RecoveryEmailService(
            identityRepository as unknown as IdentityRepository,
            recoveryRepository as unknown as RecoveryRepository
        );
    });

    it("mails the blob + deeplink when the email is verified and recoverable", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue({ blob: "blob-xyz" });

        await service.requestRecoveryEmail(EMAIL);

        expect(buildRecoveryEmail).toHaveBeenCalledWith({
            blob: "blob-xyz",
            link: "https://wallet.test/recovery#blob=blob-xyz",
        });
        expect(resendClient.send).toHaveBeenCalledWith(
            expect.objectContaining({ to: EMAIL })
        );
    });

    it("no-ops when the email has no identity node", async () => {
        identityRepository.findEmailNode.mockResolvedValue(null);

        await service.requestRecoveryEmail(EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(resendClient.send).not.toHaveBeenCalled();
    });

    it("no-ops when the email node is unlinked (retired)", async () => {
        identityRepository.findEmailNode.mockResolvedValue({
            ...verifiedEmailNode(),
            unlinkedAt: new Date(),
        });

        await service.requestRecoveryEmail(EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(resendClient.send).not.toHaveBeenCalled();
    });

    it("no-ops when the email node is not verified", async () => {
        identityRepository.findEmailNode.mockResolvedValue({
            ...verifiedEmailNode(),
            verifiedAt: null,
        });

        await service.requestRecoveryEmail(EMAIL);

        expect(recoveryRepository.findByGroup).not.toHaveBeenCalled();
        expect(resendClient.send).not.toHaveBeenCalled();
    });

    it("no-ops when the group has no stored recovery blob", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue(null);

        await service.requestRecoveryEmail(EMAIL);

        expect(resendClient.send).not.toHaveBeenCalled();
    });

    it("swallows send failures so existence is never leaked", async () => {
        identityRepository.findEmailNode.mockResolvedValue(verifiedEmailNode());
        recoveryRepository.findByGroup.mockResolvedValue({ blob: "blob-xyz" });
        vi.mocked(resendClient.send).mockRejectedValue(
            new Error("resend down")
        );

        await expect(
            service.requestRecoveryEmail(EMAIL)
        ).resolves.toBeUndefined();
    });
});
