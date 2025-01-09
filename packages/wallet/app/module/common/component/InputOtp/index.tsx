"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";
import {
    type ComponentPropsWithoutRef,
    type ComponentRef,
    forwardRef,
    useContext,
} from "react";
import styles from "./index.module.css";

/**
 * Input OTP component
 * from: https://ui.shadcn.com/docs/components/input-otp
 */
const InputOTP = forwardRef<
    ComponentRef<typeof OTPInput>,
    ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
    <OTPInput
        ref={ref}
        containerClassName={styles.inputOtp__container}
        className={styles.inputOtp}
        {...props}
    />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = forwardRef<
    ComponentRef<"div">,
    ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
    <div ref={ref} className={styles.inputOtpGroup} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = forwardRef<
    ComponentRef<"div">,
    ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
    const inputOTPContext = useContext(OTPInputContext);
    const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

    return (
        <div
            ref={ref}
            className={
                styles.inputOtpSlot + (isActive ? ` ${styles.active}` : "")
            }
            {...props}
        >
            {char}
            {hasFakeCaret && (
                <div className={styles.inputOtpSlot__fakeCaret}>
                    <div className={styles.inputOtpSlot__fakeCaret__inner} />
                </div>
            )}
        </div>
    );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = forwardRef<
    ComponentRef<"div">,
    ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
    <div ref={ref} {...props}>
        <Dot />
    </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
