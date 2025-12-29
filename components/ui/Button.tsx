"use client";

import { clsx } from "clsx";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  fullWidth = true,
  className,
  children,
  ...props
}) => {
  const base =
    "rounded-xl font-semibold text-lg px-4 py-3 h-14 transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-primary text-white hover:bg-emerald-800",
    secondary:
      "bg-white text-brand-accent border border-brand-accent hover:bg-brand-surface",
    ghost: "bg-transparent text-brand-accent border border-transparent"
  };

  return (
    <button
      className={clsx(base, variants[variant], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
};
