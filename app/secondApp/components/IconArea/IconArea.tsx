import { IconAreaType } from "~/interface/interface";
import style from "./iconArea.module.scss";
import vmpIcon from "../imagesMilitary/ВМП.svg";

export const IconArea = (children: IconAreaType) => {
  return (
    <div
      className={style.wrapper}
      style={{
        width: children.width,
        height: children.height,
        backgroundColor: children.backgroundColor,
      }}
    >
      {children.icon ? <img src={children.icon} /> : '?'}
    </div>
  );
};
// SVG импортируем по пути, называем как как угодно, пример - vmpIcon.
