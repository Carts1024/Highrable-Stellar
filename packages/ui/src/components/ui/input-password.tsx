"use client";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";

export function InputPassword({
  className,
  type = "password",
  ...props
}: ComponentPropsWithoutRef<"input">) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputGroup className={className}>
      <InputGroupInput type={showPassword ? "text" : type} {...props} />
      <InputGroupAddon
        align="inline-end"
        onClick={() => {
          setShowPassword(!showPassword);
        }}
        className="cursor-pointer"
      >
        {showPassword ? (
          <EyeOffIcon className="size-4 text-gray-400" />
        ) : (
          <EyeIcon className="size-4 text-gray-400" />
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
