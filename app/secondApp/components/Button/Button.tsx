import type { ButtonHTMLAttributes } from "react";
import { Link } from "react-router";
import clsx from "clsx";

import styles from "./button.module.scss";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  text: string;
  to?: string;
  variant?: "primary" | "secondary";
  size?: "s" | "m";
  fullWidth?: boolean;
};

export function Button({
  text,
  to,
  variant = "primary",
  size = "m",
  fullWidth = false,
  className,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const buttonClassName = clsx(
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  );

  if (to) {
    return <Link className={buttonClassName} to={to}>{text}</Link>;
  }

  return (
    <button className={buttonClassName} type={type} {...buttonProps}>
      {text}
    </button>
  );
}
