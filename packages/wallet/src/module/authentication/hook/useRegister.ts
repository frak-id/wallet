import { getUsername } from "@/context/wallet/action/register";
import { useLastAuthentication } from "@/module/authentication/hook/useLastAuthentication";
import { useEffect, useState } from "react";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
    const { username: lastUsername } = useLastAuthentication();

    // The current username
    const [username, setUsername] = useState<string>(lastUsername);

    // Generate a random username if needed
    useEffect(() => {
        if (!(username || lastUsername)) {
            // Generate a new username
            getUsername().then(setUsername);
        }
    }, [username, lastUsername]);

    return {
        username,
    };
}
