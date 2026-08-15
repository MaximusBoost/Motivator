import { StartCardType } from '~/interface/interface';
import style from './startCard.module.scss';

export const StartCard = (children: StartCardType) => {
    return (
        <div className={style.wrapper}>
            <p className={style.boldText}>{children.value}</p>
            <p className={style.underText}>{children.underText}</p>
        </div>
    )
}