"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface LottieEmptyStateProps {
  title: string;
  description?: string;
  src?: string;
  className?: string;
  fullContainer?: boolean;
}

const DEFAULT_SRC = "https://lottie.host/ca995678-82f5-4eaa-92d7-0164bc39f805/aAmlco7NES.lottie";

export default function LottieEmptyState({
  title,
  description,
  src = DEFAULT_SRC,
  className,
  fullContainer = false,
}: LottieEmptyStateProps) {
  const containerClass = fullContainer ? "h-full" : "max-w-md";
  return (
    <div
      className={`flex w-full ${containerClass} flex-col items-center gap-4 rounded-xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm${className ? ` ${className}` : ""}`}
    >
      <DotLottieReact src={src} loop autoplay className="h-150 w-150" />
      <div>
        <h2 className="text-lg font-semibold text-[#111]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#9ca3af]">{description}</p>}
      </div>
    </div>
  );
}
