import { TestRegister } from "@/module/authentication/component/Register";
import { ClientOnly } from "@/module/common/component/ClientOnly";

export default async function HomePage() {
    // Otherwise, display the login page
    return (
        <>
            <h1>Welcooome</h1>
            <ClientOnly>
                <TestRegister />
            </ClientOnly>
        </>
    );
}
