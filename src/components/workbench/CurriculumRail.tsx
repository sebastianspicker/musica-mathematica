import { useId, useState, type ReactElement } from "react";
import type { LabDomain, LabId } from "../../labs/types";
import { lessonRoute } from "../../labs/types";
import { InterfaceIcon } from "../InterfaceIcon";

export type CurriculumRailProps = Readonly<{
  domains: readonly LabDomain[];
  activeLabId: LabId;
  activeLessonId: string;
}>;

export function CurriculumRail({
  domains,
  activeLabId,
  activeLessonId,
}: CurriculumRailProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const activeDomain = domains.find((domain) => domain.id === activeLabId);
  const activeLesson = activeDomain?.lessons.find((lesson) => lesson.id === activeLessonId);

  return (
    <nav
      className={expanded ? "mm-curriculum-rail mm-curriculum-rail--expanded" : "mm-curriculum-rail"}
      aria-label="Mathematical music curriculum"
    >
      <button
        aria-controls={listId}
        aria-expanded={expanded}
        className="mm-curriculum-rail__toggle"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <InterfaceIcon name="menu" />
        <span>
          <small>Curriculum</small>
          <strong>{activeDomain?.number}.{activeLesson?.number} {activeLesson?.shortTitle}</strong>
        </span>
        <InterfaceIcon name="chevron-down" />
      </button>
      <h2 className="mm-curriculum-rail__heading">Curriculum</h2>
      <ol className="mm-curriculum-rail__domains" id={listId}>
        {domains.map((domain) => {
          const domainIsActive = domain.id === activeLabId;
          const firstLesson = domain.lessons[0];
          const domainMeta = domainIsActive && activeLesson
            ? `${domain.lessons.length} lessons · ${activeLesson.level}`
            : `${domain.lessons.length} lessons`;
          const domainHeading = (
            <>
              <span className="mm-curriculum-rail__number">
                {String(domain.number).padStart(2, "0")}
              </span>
              <span className="mm-curriculum-rail__domain-meta">
                <span className="mm-curriculum-rail__domain-title">{domain.title}</span>
                <span className="mm-curriculum-rail__domain-meta-line">{domainMeta}</span>
              </span>
            </>
          );

          return (
            <li
              className={domainIsActive
                ? "mm-curriculum-rail__domain mm-curriculum-rail__domain--active"
                : "mm-curriculum-rail__domain"}
              key={domain.id}
            >
              {firstLesson
                ? (
                  <a
                    className="mm-curriculum-rail__domain-heading"
                    href={lessonRoute(firstLesson)}
                    onClick={() => setExpanded(false)}
                  >
                    {domainHeading}
                  </a>
                )
                : <div className="mm-curriculum-rail__domain-heading">{domainHeading}</div>}
              <ol className="mm-curriculum-rail__lessons">
                {domain.lessons.map((lesson) => {
                  const lessonIsActive = domainIsActive && lesson.id === activeLessonId;

                  return (
                    <li key={lesson.id}>
                      <a
                        className={lessonIsActive
                          ? "mm-curriculum-rail__lesson mm-curriculum-rail__lesson--active"
                          : "mm-curriculum-rail__lesson"}
                        href={lessonRoute(lesson)}
                        aria-current={lessonIsActive ? "page" : undefined}
                        onClick={() => setExpanded(false)}
                      >
                        <span className="mm-curriculum-rail__lesson-dot" aria-hidden="true" />
                        <span className="mm-curriculum-rail__lesson-body">
                          <span className="mm-curriculum-rail__lesson-tag">{lesson.level}</span>
                          <span className="mm-curriculum-rail__lesson-title">{lesson.shortTitle}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
