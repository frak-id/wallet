import { LoginItem } from "@/module/authentication/component/LoginItem";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";

export function LoginList() {
    const { lastAuthentications } = useLastAuthentications();

    return (
        <ul>
            {lastAuthentications?.map((auth) => (
                <LoginItem key={auth.username} auth={auth} />
            ))}
        </ul>
    );
}
