import type { ReactElement } from "react";
import { renderToString } from "katex";

type MathTextProps = {
  className?: string;
  display?: boolean;
  label: string;
  latex: string;
};

export function MathText({
  className,
  display = false,
  label,
  latex,
}: MathTextProps): ReactElement {
  const html = renderToString(latex, {
    displayMode: display,
    output: "html",
    throwOnError: false,
    trust: false,
  });
  const mathClassName = [display ? "math-display" : "math-inline", className]
    .filter(Boolean)
    .join(" ");

  if (display) {
    return (
      <div
        aria-label={label}
        className={mathClassName}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      aria-label={label}
      className={mathClassName}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
