import { CheckboxWithLabel } from "@/module/forms/Checkbox";
import styles from "./index.module.css";

export function CheckboxList() {
    return (
        <div className={styles.checkboxWrapper}>
            <CheckboxWithLabel
                label={
                    <>
                        Credit
                        <span className={styles.checkbox__information}>
                            Advertisements for credit card offers, car loans,
                            long-term financing or similar offers.
                        </span>
                    </>
                }
                id="credit"
            />
            <CheckboxWithLabel
                label={
                    <>
                        Jobs
                        <span className={styles.checkbox__information}>
                            Advertisements for job offers, internships,
                            professional certification programs or other similar
                            offers.
                        </span>
                    </>
                }
                id="jobs"
            />
            <CheckboxWithLabel
                label={
                    <>
                        Housing
                        <span className={styles.checkbox__information}>
                            Advertisements for real estate ads, home insurance,
                            mortgages or similar offers.
                        </span>
                    </>
                }
                id="housing"
            />
            <CheckboxWithLabel
                label={
                    <>
                        Social, electoral or political issues
                        <span className={styles.checkbox__information}>
                            Advertisements concerning social issues (such as the
                            economy or civil and social rights), elections, or
                            political figures or campaigns.
                        </span>
                    </>
                }
                id="social"
            />
        </div>
    );
}
