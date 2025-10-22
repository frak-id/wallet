import { RootProvider } from "@/module/providers/RootProvider";
import Listener from "@/views/listener";

/**
 * App component - Single page listener app
 */
export default function App() {
    return (
        <RootProvider>
            <Listener />
        </RootProvider>
    );
}
