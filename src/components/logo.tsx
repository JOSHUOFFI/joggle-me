import Image from "next/image";

type LogoProps = {
  variant?: "full" | "compact" | "symbol" | "responsive";
  tone?: "light" | "dark" | "auto";
  className?: string;
  priority?: boolean;
};

/** Official JOGGLE ME logo assets, sourced from public/brand. */
export function Logo({
  variant = "full",
  tone = "light",
  className = "",
  priority = false,
}: LogoProps) {
  const surface = tone === "dark"
    ? "rounded-xl bg-white px-2 py-1"
    : tone === "auto"
      ? "rounded-xl px-2 py-1 dark:bg-white"
      : "";
  const full = (
    <Image
      src="/brand/joggle-me-logo-trimmed.png"
      alt="JOGGLE ME — Learn. Challenge Yourself. Level Up."
      width={1530}
      height={500}
      sizes="(max-width: 640px) 160px, 230px"
      priority={priority}
      className={`h-auto w-full ${className}`}
    />
  );
  const symbol = (
    <Image
      src="/brand/joggle-me-symbol.png"
      alt="JOGGLE ME"
      width={525}
      height={525}
      sizes="48px"
      priority={priority}
      className={`h-auto w-full ${className}`}
    />
  );

  if (variant === "symbol") return <span className={`inline-flex w-10 ${surface}`}>{symbol}</span>;
  if (variant === "responsive") {
    return (
      <span className={`inline-flex items-center ${surface}`}>
        <span className="hidden w-[190px] sm:inline-flex">{full}</span>
        <span className="inline-flex w-10 sm:hidden">{symbol}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex ${surface}`}>
      <span className={variant === "compact" ? "w-40" : "w-[220px] max-w-full"}>{full}</span>
    </span>
  );
}
