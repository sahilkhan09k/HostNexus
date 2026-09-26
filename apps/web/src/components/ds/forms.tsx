"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export interface SearchBarProps {
  placeholder?: string;
  buttonLabel?: string;
  /** glass = translucent dark over photos; light = white on page */
  tone?: "glass" | "light";
  /** Accessible name for the input */
  label?: string;
  defaultValue?: string;
  width?: number | string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

/** Pill search field with ember submit; sits bottom-right of the hero. */
export function SearchBar({
  placeholder = "Search", buttonLabel = "Search", tone = "glass", label, defaultValue = "",
  width = 300, onChange, onSubmit, className, style,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <form
      role="search"
      className={cn("hn-search", `hn-search--${tone}`, className)}
      style={{ width, ...style }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
    >
      <input
        className="hn-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label || placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
      />
      <button type="submit" className="hn-search__submit">{buttonLabel}</button>
    </form>
  );
}

export interface EmailFieldProps {
  placeholder?: string;
  defaultValue?: string;
  tone?: "dark" | "light";
  onSubmit?: (email: string) => void;
  className?: string;
  style?: CSSProperties;
}

/** Pill email input with a round arrow submit. */
export function EmailField({ placeholder = "you@email.com", defaultValue = "", tone = "dark", onSubmit, className, style }: EmailFieldProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <form
      className={cn("hn-email", `hn-email--${tone}`, className)}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
    >
      <input
        className="hn-email__input"
        type="email"
        required
        value={value}
        placeholder={placeholder}
        aria-label="Email address"
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" aria-label="Subscribe" className="hn-email__submit">
        <Icon name="arrow-up-right" size={18} />
      </button>
    </form>
  );
}
