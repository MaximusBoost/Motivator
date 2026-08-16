import { SubjectCardType } from "~/data/types";
import { IconArea } from "../IconArea/IconArea";
import { ProgressTrack } from "../ProgressTrack/ProgressTrack";
import style from "./subjectCard.module.scss";

export const SubjectCard = (props: SubjectCardType) => {
  return (
    <>
      <IconArea
        height="46px"
        width="46px"
        backgroundColor="var(--color-surface-subtle-blue)"
      />

      <h2 className={style.title}>{props.title}</h2>
      <h3 className={style.subtitle}>{props.subtitle}</h3>
      <div className={style.currentModulesAndPercent}>
        <p className={style.modules}>{props.modules.length}</p>
        <p className={style.progressPercent}>{props.progressPercent}</p>
      </div>
      <ProgressTrack key={props.id} value={props.progressPercent} />
    </>
  );
};
