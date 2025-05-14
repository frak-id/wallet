import { Fragment } from "preact/jsx-runtime";
import styles from "./index.module.css";

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateIds(count: number) {
    return Array.from({ length: count }, () =>
        Math.random().toString(36).slice(2, 10)
    );
}

export function Confetti({ open }: { open: boolean }) {
    const count = 200;
    const ids = generateIds(count);

    const pieces = ids.map((id) => {
        const style = {
            transform: `
                skewY(${getRandomInt(0, 50)}deg)
                rotate(${getRandomInt(0, 360)}deg)
                translate(${getRandomInt(0, 100)}px, ${getRandomInt(0, 500) * -5}px)
                scale(${getRandomInt(1, 5) / 10})
            `,
            background: `hsla(${getRandomInt(0, 360)},100%,50%,1)`,
            animationDelay: `${getRandomInt(0, 5) / 20}s`,
            bottom: `${getRandomInt(0, 10)}px`,
            opacity: 0.3,
        };

        return (
            <p
                key={id}
                style={style}
                className={`${open ? styles.animated : ""}`}
            />
        );
    });

    return (
        <Fragment>
            <div
                className={`${styles.confetti} ${open ? styles.animated : ""}`}
            >
                {pieces}
            </div>
        </Fragment>
    );
}
