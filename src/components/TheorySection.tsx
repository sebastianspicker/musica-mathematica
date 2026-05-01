import type { ReactElement } from "react";
import { MathText } from "./MathText";

type TheoryBlock = {
  body: ReactElement;
  title: string;
};

const theoryBlocks: readonly TheoryBlock[] = [
  {
    title: "1. Ensemble timing is oscillator coupling",
    body: (
      <>
        Each player has an internal phase <MathText label="theta i" latex={"\\theta_i"} />{" "}
        and a natural tempo <MathText label="omega i" latex={"\\omega_i"} />. Tempo spread
        models the distribution of individual preferred tempi. Listening is the coupling
        strength <MathText label="K" latex="K" />: the stronger the response to others,
        the more each player is pulled toward the ensemble mean phase.
      </>
    ),
  },
  {
    title: "2. Coherence is the shared pulse becoming visible",
    body: (
      <>
        The phase circle is the Kuramoto order parameter{" "}
        <MathText label="r of t" latex="r(t)" /> in classroom form. When dots are spread
        around the circle, <MathText label="r" latex="r" /> is low and the ensemble is
        incoherent. When the dots cluster, <MathText label="r approaches one" latex={"r\\to1"} />{" "}
        and the group has crossed into shared timing.
      </>
    ),
  },
  {
    title: "3. Latency turns listening into delayed information",
    body: (
      <>
        With delay, a musician hears{" "}
        <MathText label="theta j at t minus tau" latex={"\\theta_j(t-\\tau)"} />, not{" "}
        <MathText label="theta j at t" latex={"\\theta_j(t)"} />. Delay rotates the cue
        backward in phase. As tempo rises, the same physical delay occupies a larger
        fraction of the beat, so the idealized model phase budget shrinks.
      </>
    ),
  },
  {
    title: "4. Jitter is worse than a stable delay",
    body: (
      <>
        The NMP delay budget is cumulative: capture, buffering, network, and playback all
        add up. Jitter forces larger buffers and makes feedback unreliable. The simulator
        turns that into a qualitative penalty, not a measured jitter-response curve.
      </>
    ),
  },
  {
    title: "5. Topology changes peer coupling",
    body: (
      <>
        Everyone-hears-everyone is peer coupling. Leader/follower routing concentrates
        timing authority. Section routing lets subgroups stabilise locally. A click track
        replaces peer adaptation with external forcing: timing can improve, but expressive
        micro-adjustment moves away from the ensemble.
      </>
    ),
  },
  {
    title: "6. Texture changes the physical question",
    body: (
      <>
        Pulse-based and dense rhythmic material need tight phase agreement. Drone, rubato,
        and call-response textures can tolerate more delay because simultaneity is less
        central. In this lab, texture profiles are qualitative teaching presets, not
        measured latency-tolerance curves.
      </>
    ),
  },
  {
    title: "7. Infrastructure is part of the instrument",
    body: (
      <>
        Low-latency networked performance shows that latency is not just geography.
        Routing, campus hops, firewall inspection, buffer policy, documentation, support,
        and governance determine operational reliability for real rehearsals.
      </>
    ),
  },
];

export function TheorySection(): ReactElement {
  return (
    <section className="theory-section" aria-labelledby="theory-heading">
      <div className="theory-intro">
        <p className="eyebrow">Theory and evidence context</p>
        <h2 id="theory-heading">From Synchronisation Physics to Networked Music Practice</h2>
        <p>
          This lab connects the Kuramoto ensemble model, published low-latency networked
          music performance work, and operational infrastructure constraints. The point is
          not to make latency disappear. The point is to make its musical consequences
          audible, visible, and discussable.
        </p>
      </div>

      <div className="theory-grid">
        {theoryBlocks.map((block) => (
          <article key={block.title}>
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </article>
        ))}
      </div>

      <div className="theory-transfer">
        <h3>Evidence in the Simulation</h3>
        <p>
          The practical questions are implemented as lessons 4-7. The model combines
          coupled-oscillator theory, delayed auditory feedback, published low-latency
          network performance evidence, and operational evidence about jitter, routing,
          buffers, and support.
        </p>
      </div>

      <p className="source-note">
        The simulation is self-contained: each box states the physical or operational
        assumption it uses, so students can interpret the result without external reading.
      </p>
    </section>
  );
}
