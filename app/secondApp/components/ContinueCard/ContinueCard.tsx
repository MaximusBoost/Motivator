import { IconArea } from "../IconArea/IconArea";
import style from "./continueCard.module.scss";
import vmpIcon from "../imagesMilitary/ВМП.svg";
import { ContinueCardType } from "~/interface/interface";

export const ContinueCard = (children: ContinueCardType) => {
  return (
    <div className={style.wrapper}>
      <div className={style.upPart}>
        <IconArea icon={vmpIcon} width="50px" height="50px" />
        <div className={style.upLeftPart}>
          <p className={style.nameSubject}>{children.nameSubject}</p>
          <p className={style.underNameSubject}>
            Модуль {children.firstSerialNumber} из {children.secondSerialNumber}{" "}
            • {children.nameModule}
          </p>
        </div>
      </div>
      <div className={style.downPart}>
        <div className={style.leftDownPart}></div>
        <p className={style.upTextDownPart}>Следующая задача</p>
        <p>{children.contuniueQuest}</p>
        <div className={style.progressTrack}></div>
        {/* тут надо организовать процентный прогресс выполняемой таски пользователем */}
      </div>
    </div>
  );
};
