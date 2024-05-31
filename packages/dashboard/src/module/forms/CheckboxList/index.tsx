import { Checkbox } from "@/module/forms/Checkbox";
import { Label } from "@/module/forms/Label";
import styles from "./index.module.css";

export function CheckboxList() {
    return (
        <div className={styles.checkboxWrapper}>
            <p className={styles.checkbox}>
                <span>
                    <Checkbox id={"credit"} />
                </span>
                <Label htmlFor={"credit"} className={styles.checkbox__label}>
                    Credit
                    <span className={styles.checkbox__information}>
                        Advertisements for credit card offers, car loans,
                        long-term financing or similar offers.
                    </span>
                </Label>
            </p>
            <p className={styles.checkbox}>
                <span>
                    <Checkbox id={"jobs"} />
                </span>
                <Label htmlFor={"jobs"} className={styles.checkbox__label}>
                    Jobs
                    <span className={styles.checkbox__information}>
                        Advertisements for job offers, internships, professional
                        certification programs or other similar offers.
                    </span>
                </Label>
            </p>
            <p className={styles.checkbox}>
                <span>
                    <Checkbox id={"housing"} />
                </span>
                <Label htmlFor={"housing"} className={styles.checkbox__label}>
                    Housing
                    <span className={styles.checkbox__information}>
                        Advertisements for real estate ads, home insurance,
                        mortgages or similar offers.
                    </span>
                </Label>
            </p>
            <p className={styles.checkbox}>
                <span>
                    <Checkbox id={"social"} />
                </span>
                <Label htmlFor={"social"} className={styles.checkbox__label}>
                    Social, electoral or political issues
                    <span className={styles.checkbox__information}>
                        Advertisements concerning social issues (such as the
                        economy or civil and social rights), elections, or
                        political figures or campaigns.
                    </span>
                </Label>
            </p>
        </div>
    );
}
