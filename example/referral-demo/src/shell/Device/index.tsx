import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { DEVICE_BEZEL, DEVICE_HEIGHT, DEVICE_WIDTH } from "../device.css";
import { StatusBar } from "../StatusBar";
import * as styles from "./device.css";

const OUTER_WIDTH = DEVICE_WIDTH + DEVICE_BEZEL * 2;
const OUTER_HEIGHT = DEVICE_HEIGHT + DEVICE_BEZEL * 2;

function useFitScale(maxScale: number) {
    const ref = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        const measure = () => {
            const { width, height } = node.getBoundingClientRect();
            setScale(
                Math.min(maxScale, width / OUTER_WIDTH, height / OUTER_HEIGHT)
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [maxScale]);

    return { ref, scale };
}

/**
 * A phone drawn on the desk, scaled to fit its parent. The screen inside keeps
 * its logical size, so every surface lays out exactly as on a real phone.
 */
export function PhoneFrame({
    tone,
    time = "9:41",
    children,
    maxScale = 1,
}: {
    tone: "dark" | "light";
    /** The status-bar clock: Apple's 9:41 until the story says otherwise. */
    time?: string;
    children: ReactNode;
    maxScale?: number;
}) {
    const { ref, scale } = useFitScale(maxScale);

    return (
        <div ref={ref} className={styles.fit}>
            <div
                className={styles.sizer}
                style={{
                    width: OUTER_WIDTH * scale,
                    height: OUTER_HEIGHT * scale,
                    visibility: scale ? "visible" : "hidden",
                }}
            >
                <div
                    className={styles.phone}
                    style={{ transform: `scale(${scale})` }}
                >
                    <div className={styles.frameScreen}>
                        {children}
                        <StatusBar tone={tone} time={time} />
                        <div className={styles.island} />
                        <div className={styles.homeIndicator({ tone })} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** The real phone is the device: draw edge to edge inside the OS safe areas. */
export function FullScreenDevice({ children }: { children: ReactNode }) {
    return <div className={styles.fullScreen}>{children}</div>;
}
