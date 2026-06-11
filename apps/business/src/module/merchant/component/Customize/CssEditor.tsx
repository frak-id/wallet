import * as styles from "./customize.css";

export function CssEditor({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <textarea
            className={styles.cssTextarea}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
        />
    );
}
