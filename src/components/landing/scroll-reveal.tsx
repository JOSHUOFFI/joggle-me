"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ScrollReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element?.setAttribute("data-revealed", "true");
      return;
    }

    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.setAttribute("data-revealed", "true");
        observer.unobserve(element);
      }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={elementRef} className={`scroll-reveal ${className}`}>{children}</div>;
}
