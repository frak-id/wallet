import type { KyInstance } from "ky";

/**
 * Class helping us with 6degrees authentication
 */
export class SixDegreesAuthenticationService {
    constructor(private readonly api: KyInstance) {}

    /**
     * Perform a SixDegrees registration
     */
    async register(): Promise<string | undefined> {
        console.log("Registering to 6degrees", { api: this.api });
        return "token";
    }

    /**
     * Perform a SixDegrees login
     */
    async login(): Promise<string | undefined> {
        // todo: Test six degrees login
        // todo: If login fails, try a register?
        // todo: If both fail, return undefined
        return "token";
    }
}
