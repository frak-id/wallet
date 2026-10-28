import { adminWalletsRepository } from "@backend-infrastructure";
import { InstagramGraphClient } from "../../infrastructure/integrations/instagram";
import { InstagramAccessTokenRepository } from "./repositories/InstagramAccessTokenRepository";
import { InstagramDeclarationRepository } from "./repositories/InstagramDeclarationRepository";
import { InstagramLinkCodeRepository } from "./repositories/InstagramLinkCodeRepository";
import { InstagramLinkRepository } from "./repositories/InstagramLinkRepository";
import { InstagramLinkService } from "./services/InstagramLinkService";
import { InstagramTokenCipher } from "./services/InstagramTokenCipher";
import { InstagramTokenService } from "./services/InstagramTokenService";
import { InstagramVerificationService } from "./services/InstagramVerificationService";

const instagramLinkRepository = new InstagramLinkRepository();
const instagramDeclarationRepository = new InstagramDeclarationRepository();
const instagramLinkCodeRepository = new InstagramLinkCodeRepository();
const graphClient = new InstagramGraphClient();

const instagramLinkService = new InstagramLinkService(
    instagramLinkRepository,
    instagramDeclarationRepository,
    instagramLinkCodeRepository
);
const instagramTokenService = new InstagramTokenService(
    new InstagramAccessTokenRepository(),
    new InstagramTokenCipher(adminWalletsRepository),
    graphClient
);
const instagramVerificationService = new InstagramVerificationService(
    instagramLinkRepository,
    instagramLinkCodeRepository,
    instagramLinkService,
    instagramTokenService,
    graphClient
);

export namespace InstagramContext {
    export const repositories = {
        instagramLink: instagramLinkRepository,
        instagramDeclaration: instagramDeclarationRepository,
    };
    export const services = {
        instagramLink: instagramLinkService,
        instagramToken: instagramTokenService,
        instagramVerification: instagramVerificationService,
    };
}
