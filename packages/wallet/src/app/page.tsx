import { TestRegister } from "@/module/authentication/component/Register";
import { ClientOnly } from "@/module/common/component/ClientOnly";

export default async function HomePage() {
    // Otherwise, display the login page
    return (
        <>
            <ClientOnly>
                <TestRegister />
            </ClientOnly>
        </>
    );
}
