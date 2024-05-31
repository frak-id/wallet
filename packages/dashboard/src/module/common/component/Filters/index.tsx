import { Button } from "@/module/common/component/Button";
import { InputSearch } from "@/module/forms/InputSearch";
import { Calendar, SlidersHorizontal } from "lucide-react";
import styles from "./index.module.css";

export function Filters() {
    return (
        <div className={styles.filters}>
            <div className={styles.filters__item}>
                <InputSearch
                    placeholder={"Search campaign..."}
                    classNameWrapper={styles.filters__search}
                />
            </div>
            <div className={styles.filters__item}>
                <Button variant={"secondary"} leftIcon={<Calendar size={20} />}>
                    4 Sep 2022
                </Button>
                <Button
                    variant={"secondary"}
                    leftIcon={<SlidersHorizontal size={20} />}
                >
                    Filters
                </Button>
            </div>
        </div>
    );
}
