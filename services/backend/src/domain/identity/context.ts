import { IdentityRepository } from "./repositories/IdentityRepository";

const identityRepository = new IdentityRepository();

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
    };
}
