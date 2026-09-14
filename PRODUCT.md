# Product guide

Musica Mathematica helps music students work through a question with a
mathematical model. They make a prediction, change one factor, compare two
runs, and explain what happened. Selected lessons also analyze short audio
segments in the browser.

This guide describes the audience and design choices behind the app. For the
lesson catalog and teaching suggestions, see the
[curriculum guide](docs/MUSICA_MATHEMATICA_CURRICULUM.md).

## Who it is for

The lessons are written for university and conservatoire music students and
teachers working in theory, analysis, acoustics, composition, ensemble
practice, or performance technology. The three levels in each domain introduce
the mathematics, develop a model, and examine its limits.

The app supports classroom discussion and individual study. It has no course
administration, remote collaboration, or automatic grading. Results cannot be
used as a diagnosis, a calibrated measurement, or a complete transcription.

## The lesson experience

A lesson starts with a musical question, an equation, and the assumptions that
connect them. Students write a prediction before seeing results, then record
two trials with one changed factor. The comparison shows the inputs and
observations from both runs.

Students explain the difference, try the idea through listening, performance,
or score study, and apply it to another context. A final reflection asks what
the model leaves out and what further evidence would help. The
[scientific basis](docs/SCIENTIFIC_BASIS.md) explains how the app distinguishes
calculations, observations, and interpretations.

## Results and privacy

Every mathematical result needs its units, method, source, and calibration
status. A simulated result describes the model; it cannot stand in for an
observation of musicians, a room, or a network. Labels derived from audio
remain observations or hypotheses.

The portfolio stays in the learner's browser unless they export it. Raw audio,
file names, media streams, and device identifiers stay out of portfolio
storage. The interface must not suggest that completing a lesson establishes
mastery or that its results measure musical ability.

## Interface design

The current task and next action should be easy to find. Results should keep
their evidence labels and interpretation limits close by, including in
presentation mode. Status needs text or symbols as well as color.

Keyboard focus, reduced-motion settings, and readable projection layouts are
part of the design requirements. Formal WCAG conformance and classroom
effectiveness have not been established.
