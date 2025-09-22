import ky from "ky";
import { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import { SixDegreesAuthenticationService } from "./service/SixDegreesAuthenticationService";
import { SixDegreesInteractionService } from "./service/SixDegreesInteractionService";
import { SixDegreesRoutingService } from "./service/SixDegreesRoutingService";

/**
 * The whole 6degrees context
 */
export namespace SixDegreesContext {
    // Build the ky api that will be used to interact with 6degrees
    export const api = ky.create({
        prefixUrl: "https://prodbe-f2m.6degrees.co/",
    });

    // Create the routing service
    const routingService = new SixDegreesRoutingService();

    // Create the authentication service
    const authenticationService = new SixDegreesAuthenticationService(api);

    // Create the interaction service
    const authenticatorRepository = new AuthenticatorRepository();
    const interactionService = new SixDegreesInteractionService(
        api,
        authenticatorRepository
    );

    export const repositories = {
        authenticator: authenticatorRepository,
    };

    export const services = {
        authentication: authenticationService,
        interaction: interactionService,
        routing: routingService,
    };
}
