import { sessionAtom } from "@/module/common/atoms/session";
import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { Notifications } from "@frak-labs/ui/icons/Notifications";
import { useAtomValue } from "jotai";
import { Link } from "react-router";
import { useHydrated } from "remix-utils/use-hydrated";
import styles from "./index.module.css";

export function Header() {
    const isHydrated = useHydrated();
    const session = useAtomValue(sessionAtom);

    return (
        <>
            <header className={styles.header}>
                <h1>
                    <Link
                        to={"/wallet"}
                        className={styles.header__logo}
                        viewTransition
                    >
                        <LogoFrakWithName />
                    </Link>
                </h1>
                {isHydrated && session && (
                    <Link
                        to={"/notifications"}
                        className={styles.header__notification}
                        viewTransition
                    >
                        <Notifications />
                    </Link>
                )}
            </header>
        </>
    );
}
