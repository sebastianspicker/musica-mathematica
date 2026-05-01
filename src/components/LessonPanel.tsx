import type { ReactElement } from "react";
import type { LessonPreset } from "../simulation/presets";

type LessonPanelProps = {
  activeLessonId: string;
  isExploring: boolean;
  lessons: readonly LessonPreset[];
  onSelectLesson: (lessonId: string) => void;
};

export function LessonPanel({
  activeLessonId,
  isExploring,
  lessons,
  onSelectLesson,
}: LessonPanelProps): ReactElement {
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) ?? lessons[0];

  return (
    <aside className="lesson-panel" aria-label="Guided lessons">
      <div className="panel-heading">
        <h2>Lessons</h2>
        <span>{isExploring ? "Custom exploration" : "Lesson preset"}</span>
      </div>
      <div className="lesson-tabs">
        {lessons.map((lesson) => (
          <button
            className={lesson.id === activeLessonId ? "active" : ""}
            key={lesson.id}
            onClick={() => onSelectLesson(lesson.id)}
            type="button"
          >
            {lesson.title}
          </button>
        ))}
      </div>
      <p>{activeLesson.purpose}</p>
      <ol>
        {activeLesson.prompts.map((prompt) => (
          <li key={prompt}>{prompt}</li>
        ))}
      </ol>
    </aside>
  );
}
