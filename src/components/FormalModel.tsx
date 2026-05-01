import type { ReactElement } from "react";
import { MathText } from "./MathText";

export const kuramotoLatex =
  "\\frac{d\\theta_i}{dt} = \\omega_i + \\sum_j K_{ij}\\sin(\\theta_j(t-\\tau_{ij})-\\theta_i)";

export function FormalModel(): ReactElement {
  return (
    <section className="formal-model" aria-labelledby="formal-model-heading">
      <div>
        <p className="eyebrow">Formalize after experience</p>
        <h2 id="formal-model-heading">Delayed Kuramoto Ensemble Model</h2>
      </div>
      <MathText
        className="katex-display-wrap"
        display
        label="d theta i over d t equals omega i plus sum over j of K i j times sine of theta j at t minus tau i j minus theta i"
        latex={kuramotoLatex}
      />
      <p>
        This is a phase-only abstraction: it tracks{" "}
        <MathText label="theta i" latex={"\\theta_i"} /> and{" "}
        <MathText label="omega i" latex={"\\omega_i"} />, while texture, jitter,
        and click parameters remain qualitative teaching controls.
      </p>
    </section>
  );
}
