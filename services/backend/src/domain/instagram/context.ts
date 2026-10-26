import { InstagramLinkRepository } from "./repositories/InstagramLinkRepository";
import { InstagramLinkService } from "./services/InstagramLinkService";

const instagramLinkRepository = new InstagramLinkRepository();
const instagramLinkService = new InstagramLinkService(instagramLinkRepository);

export namespace InstagramContext {
    export const repositories = {
        instagramLink: instagramLinkRepository,
    };
    export const services = {
        instagramLink: instagramLinkService,
    };
}
