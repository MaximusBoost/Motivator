import { IconArea } from "../IconArea/IconArea";
import style from "./continueCard.module.scss";
import vmpIcon from "../imagesMilitary/ВМП.svg";
import { ContinueCardType } from "~/interface/interface";
import { ProgressTrack } from "../ProgressTrack/ProgressTrack";
import { Button } from "../Button/Button";

export const ContinueCard = (children: ContinueCardType) => {
  return (
    <div className={style.wrapper} id={children.id}>
      <IconArea icon={vmpIcon} width="50px" height="50px" />
      <div className={style.rightMainPart}>
        <div className={style.upPart}>
          <div className={style.upLeftPart}>
            <p className={style.nameSubject}>{children.nameSubject}</p>
            <p className={style.underNameSubject}>
              Модуль {children.firstSerialNumber} из{" "}
              {children.secondSerialNumber} • {children.nameModule}
            </p>
          </div>
        </div>
        <div className={style.downPart}>
          <div className={style.downLeftPart}>
            <div className={style.leftDownPart}></div>
            <p className={style.upTextDownPart}>Следующая задача</p>
            <p className={style.downTextDownPart}>{children.contuniueQuest}</p>
            <div className={style.progressTrackWrap}>
              <ProgressTrack value={children.percent} />
              <p className={style.percentText}>{children.percent}%</p>
            </div>
          </div>
          <div className={style.btnWrapper}>

          <Button text='Продолжить'/>
          </div>
          {/* тут надо организовать процентный прогресс выполняемой таски пользователем */}
        </div>
      </div>
    </div>
  );
};
