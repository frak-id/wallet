import { adminWalletsRepository } from "@backend-infrastructure";
import { InstagramGraphClient } from "../../infrastructure/integrations/instagram";
import { InstagramAccessTokenRepository } from "./repositories/InstagramAccessTokenRepository";
import { InstagramLinkRepository } from "./repositories/InstagramLinkRepository";
import { InstagramPendingLinkRepository } from "./repositories/InstagramPendingLinkRepository";
import { InstagramLinkService } from "./services/InstagramLinkService";
import { InstagramTokenCipher } from "./services/InstagramTokenCipher";
import { InstagramTokenService } from "./services/InstagramTokenService";
import { InstagramVerificationService } from "./services/InstagramVerificationService";

const instagramLinkRepository = new InstagramLinkRepository();
const instagramPendingLinkRepository = new InstagramPendingLinkRepository();
const graphClient = new InstagramGraphClient();

const instagramLinkService = new InstagramLinkService(
    instagramLinkRepository,
    instagramPendingLinkRepository
);
const instagramTokenService = new InstagramTokenService(
    new InstagramAccessTokenRepository(),
    new InstagramTokenCipher(adminWalletsRepository),
    graphClient
);
const instagramVerificationService = new InstagramVerificationService(
    instagramLinkRepository,
    instagramPendingLinkRepository,
    instagramLinkService,
    instagramTokenService,
    graphClient
);

export namespace InstagramContext {
    export const repositories = {
        instagramLink: instagramLinkRepository,
        instagramPendingLink: instagramPendingLinkRepository,
    };
    export const services = {
        instagramLink: instagramLinkService,
        instagramToken: instagramTokenService,
        instagramVerification: instagramVerificationService,
    };
}
