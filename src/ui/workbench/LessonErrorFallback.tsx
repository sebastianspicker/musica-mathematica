import type { ReactElement } from "react";

export function LessonErrorFallback({ lessonTitle, onRetry }: Readonly<{
  lessonTitle: string;
  onRetry: () => void;
}>): ReactElement {
  return <section className="mm-workbench" aria-label={`${lessonTitle} workbench`}>
    <div className="mm-workbench__content mm-workbench__bench">
      <div className="mm-inquiry" role="alert">
        <h2>This lesson could not be displayed</h2>
        <p>Your saved attempts and recorded runs have been preserved. Retry this lesson with its default factors, or choose another lesson.</p>
        <button className="mm-primary-action" type="button" onClick={onRetry}>Retry with default factors</button>
      </div>
    </div>
  </section>;
}
