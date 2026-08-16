export type SideBarItemType = {
    height: string,
    width: string,
    fontSize: string,
    borderColor: string,
    backgroundColor: string,
    value: string
};

export type ButtonType = {
    height: string,
    width: string,
    fontSize: string,
    borderColor?: string,
    backgroundColor: string,
    value: string,
    color: string,
}

export type StartCardType = {
    value: string,
    underText: string
}

export type IconAreaType = {
    width: string,
    height: string,
    icon?: string,
    backgroundColor?: string
}

export type ContinueCardType = {
    id?: string,
    nameSubject: string | undefined,
    firstSerialNumber: number | undefined,
    secondSerialNumber: number | undefined,
    nameModule: string | undefined, // здесь сделать перечисление предметов БП
    contuniueQuest: string | undefined,
    percent: number,
}
