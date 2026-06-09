"use client";

import { cn } from "@repo/ui/lib/utils";
import React, { useRef, useState } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly spotlightColor?: string;
  readonly spotlightRadius?: number;
  readonly interactive?: boolean;
}

/**
 * A card component that projects a radial gradient overlay tracking the user's cursor.
 */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 112, 3, 0.12)",
  spotlightRadius = 250,
  interactive = true,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "hr-panel relative overflow-hidden transition-all duration-300",
        interactive && "hover:-translate-y-1 hover:border-ring/30 hover:shadow-lg",
        className,
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${spotlightRadius}px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
