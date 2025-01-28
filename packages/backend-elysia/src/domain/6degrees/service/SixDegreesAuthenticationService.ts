import type { KyInstance } from "ky";

/**
 * Class helping us with 6degrees authentication
 */
export class SixDegreesAuthenticationService {
    constructor(private readonly api: KyInstance) {}

    /**
     * Perform a SixDegrees registration
     */
    async register() {
        console.log("Registering to 6degrees", { api: this.api });
        return "token";
    }

    /**
     * Perform a SixDegrees login
     */
    async login() {
        return "token";
    }
}
