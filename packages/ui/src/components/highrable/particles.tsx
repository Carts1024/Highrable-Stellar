"use client";

import { useEffect, useRef } from "react";

interface IParticlesProps {
  readonly className?: string;
  readonly quantity?: number;
  readonly staticity?: number;
  readonly ease?: number;
  readonly refresh?: boolean;
}

interface IParticle {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
}

/**
 * High-performance interactive Canvas particle system representing the Stellar network.
 */
export function Particles({
  className = "",
  quantity = 40,
  staticity: _staticity = 50,
  ease: _ease = 50,
  refresh = false,
}: IParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<IParticle[]>([]);
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d");
    }
    initCanvas();
    let frameId = requestAnimationFrame(animate);
    window.addEventListener("resize", initCanvas);

    return () => {
      window.removeEventListener("resize", initCanvas);
      cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    initCanvas();
  }, [refresh]);

  const onMouseMove = (e: MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouse.current = { x, y };
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  const initCanvas = () => {
    resizeCanvas();
    drawParticles();
  };

  const resizeCanvas = () => {
    if (containerRef.current && canvasRef.current && context.current) {
      circles.current = [];
      canvasSize.current.w = containerRef.current.offsetWidth;
      canvasSize.current.h = containerRef.current.offsetHeight;
      canvasRef.current.width = canvasSize.current.w * dpr;
      canvasRef.current.height = canvasSize.current.h * dpr;
      canvasRef.current.style.width = `${canvasSize.current.w}px`;
      canvasRef.current.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
    }
  };

  const circleParams = (): IParticle => {
    const x = Math.random() * canvasSize.current.w;
    const y = Math.random() * canvasSize.current.h;
    const translateX = 0;
    const translateY = 0;
    // Increase base size so particles are more visible in the hero section
    const size = Math.random() * 3 + 2; // range: ~2 - 5
    const alpha = 0;
    const targetAlpha = Math.random() * 0.4 + 0.1;
    const dx = (Math.random() - 0.5) * 0.15;
    const dy = (Math.random() - 0.5) * 0.15;
    const magnetism = 0.2 + Math.random() * 3;
    return {
      x,
      y,
      translateX,
      translateY,
      size,
      alpha,
      targetAlpha,
      dx,
      dy,
      magnetism,
    };
  };

  const drawParticles = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
      for (let i = 0; i < quantity; i++) {
        const circle = circleParams();
        circles.current.push(circle);
      }
    }
  };

  const drawCircle = (circle: IParticle) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle;
      context.current.translate(translateX, translateY);
      context.current.beginPath();
      context.current.arc(x, y, size, 0, 2 * Math.PI);
      context.current.fillStyle = `rgba(255, 112, 3, ${alpha})`;
      context.current.fill();
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  const animate = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
      circles.current.forEach((circle, i) => {
        // Handle alpha fade-in
        if (circle.alpha < circle.targetAlpha) {
          circle.alpha += 0.005;
        }

        // Handle edge fading
        const edge = [
          circle.x + circle.translateX - circle.size,
          canvasSize.current.w - (circle.x + circle.translateX + circle.size),
          circle.y + circle.translateY - circle.size,
          canvasSize.current.h - (circle.y + circle.translateY + circle.size),
        ];

        const closestEdge = edge.reduce((a, b) => Math.min(a, b));
        const remapClosestEdge = parseFloat(Math.min(closestEdge, 30).toFixed(2)) / 30;

        if (closestEdge < 30) {
          circle.alpha = circle.targetAlpha * remapClosestEdge;
        } else {
          circle.alpha = circle.targetAlpha;
        }

        // Add standard velocities
        circle.x += circle.dx;
        circle.y += circle.dy;

        // Cursor magnetism (repelling)
        const dx = mouse.current.x - (circle.x + circle.translateX);
        const dy = mouse.current.y - (circle.y + circle.translateY);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          const force = (150 - distance) / 150;
          circle.translateX -= (dx / distance) * force * circle.magnetism * 0.6;
          circle.translateY -= (dy / distance) * force * circle.magnetism * 0.6;
        } else {
          circle.translateX += (0 - circle.translateX) * 0.05;
          circle.translateY += (0 - circle.translateY) * 0.05;
        }

        // Out of bounds reset
        if (
          circle.x < -circle.size ||
          circle.x > canvasSize.current.w + circle.size ||
          circle.y < -circle.size ||
          circle.y > canvasSize.current.h + circle.size
        ) {
          circles.current[i] = circleParams();
          circles.current[i].alpha = 0;
        } else {
          drawCircle(circle);
        }
      });

      // Draw mesh connection lines between nearby particles
      for (let i = 0; i < circles.current.length; i++) {
        for (let j = i + 1; j < circles.current.length; j++) {
          const c1 = circles.current[i];
          const c2 = circles.current[j];
          if (!c1 || !c2) continue;
          const dx = c1.x + c1.translateX - (c2.x + c2.translateX);
          const dy = c1.y + c1.translateY - (c2.y + c2.translateY);
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 110) {
            const alpha = (1 - distance / 110) * 0.08 * Math.min(c1.alpha, c2.alpha);
            context.current.beginPath();
            context.current.moveTo(c1.x + c1.translateX, c1.y + c1.translateY);
            context.current.lineTo(c2.x + c2.translateX, c2.y + c2.translateY);
            context.current.strokeStyle = `rgba(255, 112, 3, ${alpha})`;
            context.current.lineWidth = 0.5;
            context.current.stroke();
          }
        }
      }
    }
    requestAnimationFrame(animate);
  };

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="particles background" />
    </div>
  );
}
