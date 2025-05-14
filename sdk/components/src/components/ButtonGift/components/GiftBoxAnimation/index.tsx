import { useReducer } from "preact/hooks";
import boxLid from "../../assets/box-lid.png";
import box from "../../assets/box.png";
import kuku from "../../assets/jump-character.png";
import { Confetti } from "../Confetti";
import styles from "./index.module.css";

const init_state = {
    move: "move",
    jump: "",
    rotated: "",
    rotating: "",
};

type State = typeof init_state;

export function GiftBoxAnimation({ onClick }: { onClick: () => void }) {
    const [state, setState] = useReducer(
        (state: State, new_state: Partial<State>) => ({
            ...state,
            ...new_state,
        }),
        init_state
    );

    const { move, rotating, rotated, jump } = state;

    function animate() {
        const isDone = rotated === "rotated";

        if (!isDone) {
            setState({ rotating: "rotating" });
            setTimeout(() => {
                setState({ jump: "jump" });
            }, 300);
            setTimeout(() => {
                setState({ rotated: "rotated" });
                onClick();
            }, 1000);
        } else {
            setState(init_state);
        }
        setState({ move: move === "move" ? "" : "move" });
    }

    return (
        <div className={styles.giftBox}>
            <Confetti open={jump === "jump"} />
            <div className={styles.container}>
                <img
                    className={`${styles.kuku} ${jump !== "" ? styles.jump : ""}`}
                    src={kuku}
                    alt="kuku"
                />
                <button
                    type="button"
                    className={styles.box}
                    onClick={() => animate()}
                >
                    <img src={box} alt="box" />
                </button>
                <img
                    className={`${styles.lid} ${move !== "" ? styles.move : ""} ${rotating !== "" ? styles.rotating : ""} ${rotated !== "" ? styles.rotated : ""}`}
                    src={boxLid}
                    alt="box-lid"
                />
            </div>
        </div>
    );
}
