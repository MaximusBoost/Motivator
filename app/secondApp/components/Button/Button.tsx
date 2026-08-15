import { ButtonType } from "~/interface/interface";
import style from "./Button.module.scss";

export const Button = (children: ButtonType) => {
  return (
    <>
      <button
        className={style.btn}
        style={{
          height: children.height,
          width: children.width,
          fontSize: children.fontSize,
          backgroundColor: children.backgroundColor,
          color: children.color,
        }}
      >
        {children.value}
      </button>
    </>
  );
};
