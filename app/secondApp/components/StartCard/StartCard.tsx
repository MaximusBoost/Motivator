import style from './startCard.module.scss';

export const StartCard = (props:{count: string, smallText: string}) => {

    return (
        <div className={style.wrapper}>
            <p className={style.bigText}>{props.count}</p>
            <p className={style.smallText}>{props.smallText}</p>
        </div>
    )
}