import type { ReactElement } from "react";
import type { DomainDefinition, LessonDefinition } from "../../curriculum/contracts";

export type CurriculumRailProps = Readonly<{
  domains: readonly DomainDefinition[];
  activeDomainId: string;
  activeLessonId: string;
  lessonHref: (lesson: LessonDefinition) => string;
  lessonProgress: (lesson: LessonDefinition) => string | undefined;
  onNavigate: (lesson: LessonDefinition) => void;
}>;

const movementNumerals = ["I", "II", "III"] as const;

/** The catalog reads like an edition's contents: domains as numbered books, lessons as movements. */
export function CurriculumRail(props: CurriculumRailProps): ReactElement {
  return <nav className="mm-curriculum-rail" aria-label="Mathematical music curriculum">
    <p className="mm-curriculum-rail__count">{props.domains.length} domains · {props.domains.reduce((count, domain) => count + domain.lessons.length, 0)} lessons</p>
    <ol className="mm-curriculum-rail__domains">
      {props.domains.map((domain) => <li className="mm-curriculum-rail__domain" key={domain.id}>
        <h3><span className="mm-figure">{String(domain.number).padStart(2, "0")}</span>{domain.title}</h3>
        <p>{domain.description}</p>
        <ol className="mm-curriculum-rail__lessons">
          {domain.lessons.map((lesson) => {
            const active = domain.id === props.activeDomainId && lesson.id === props.activeLessonId;
            const progress = props.lessonProgress(lesson);
            return <li key={lesson.id}>
              <a className="mm-curriculum-rail__lesson" href={props.lessonHref(lesson)} aria-current={active ? "page" : undefined} onClick={() => props.onNavigate(lesson)}>
                <span className="mm-curriculum-rail__numeral" aria-hidden="true">{movementNumerals[lesson.number - 1] ?? lesson.number}</span>
                <span className="mm-curriculum-rail__lesson-body"><span className="mm-curriculum-rail__lesson-tag">{lesson.level}</span><span className="mm-curriculum-rail__title">{lesson.title}</span></span>
                <span className="mm-curriculum-rail__leader" aria-hidden="true" />
                <span className="mm-curriculum-rail__lesson-progress" aria-label={progress ? `Inquiry stage ${progress}` : "Not started"}>{progress ?? "Start"}</span>
              </a>
            </li>;
          })}
        </ol>
      </li>)}
    </ol>
  </nav>;
}
