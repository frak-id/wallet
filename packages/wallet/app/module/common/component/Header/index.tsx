import { LogoFrakWithName } from "@frak-labs/shared/module/asset/icons/LogoFrakWithName";
import { Notifications } from "@module/asset/icons/Notifications";
import { useAtomValue } from "jotai";
import { Link } from "react-router";
import { useHydrated } from "remix-utils/use-hydrated";
import { sessionAtom } from "../../atoms/session";
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
