import { useState } from "react";
import style from "./sideBar.module.scss";
import { SideBarItemType } from "~/interface/interface";

export const SideBarItem = (parametrs: SideBarItemType) => {
  return (
    <>
      <button
        className={style.wrap}
        style={{
          height: parametrs.height,
          width: parametrs.height,
          fontSize: parametrs.fontSize,
          borderColor: parametrs.borderColor,
          backgroundColor: parametrs.backgroundColor,
        }}
      >
        {parametrs.value}
      </button>
    </>
  );
};
