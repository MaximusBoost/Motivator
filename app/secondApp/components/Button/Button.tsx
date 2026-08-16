import style from './button.module.scss';

export const Button = (props: {text: string}) => {

    return (
        <button className={style.wrapper}>{props.text}</button>
    )
}