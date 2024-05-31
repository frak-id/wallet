import { Label } from "@/module/forms/Label";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import styles from "./index.module.css";

export function RadioList() {
    return (
        <RadioGroup defaultValue="awareness" className={styles.radiosWrapper}>
            <p className={styles.radios}>
                <RadioGroupItem value="awareness" id="awareness" />
                <Label htmlFor="awareness">Awareness</Label>
            </p>
            <p className={styles.radios}>
                <RadioGroupItem value="traffic" id="traffic" />
                <Label htmlFor="traffic">Traffic</Label>
            </p>
            <p className={styles.radios}>
                <RadioGroupItem value="registration" id="registration" />
                <Label htmlFor="registration">Registration</Label>
            </p>
            <p className={styles.radios}>
                <RadioGroupItem value="sales" id="sales" />
                <Label htmlFor="sales">Sales</Label>
            </p>
            <p className={styles.radios}>
                <RadioGroupItem value="retention" id="retention" />
                <Label htmlFor="retention">Retention</Label>
            </p>
        </RadioGroup>
    );
}
