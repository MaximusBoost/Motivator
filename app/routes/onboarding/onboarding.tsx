import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/onboarding";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import {
  getAllowedQualificationTargets,
  getNextQualificationLevel,
} from "~/data/qualification-policy";
import type {
  PersonnelCategory,
  PositionProfile,
  QualificationLevel,
  ServiceDirection,
  ServiceType,
} from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";

import styles from "./onboarding.module.scss";

const qualificationOptions = [
  { value: "third", label: "Специалист 3-го класса" },
  { value: "second", label: "Специалист 2-го класса" },
  { value: "first", label: "Специалист 1-го класса" },
  { value: "master", label: "Мастер" },
] as const;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Настройка маршрута | Motivator" }];
}

export async function clientLoader() {
  return learningRepository.getQualificationProfile(await getCurrentUserId());
}

export default function Onboarding({ loaderData: profile }: Route.ComponentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialServiceType = profile?.serviceType ?? "contract";
  const initialCurrentQualification = profile?.currentQualification ?? "none";
  const [serviceType, setServiceType] = useState<ServiceType>(initialServiceType);
  const [currentQualification, setCurrentQualification] = useState<QualificationLevel>(
    initialCurrentQualification,
  );
  const [targetQualification, setTargetQualification] = useState<Exclude<QualificationLevel, "none">>(
    profile && getAllowedQualificationTargets(initialCurrentQualification, initialServiceType)
      .includes(profile.targetQualification)
      ? profile.targetQualification
      : getNextQualificationLevel(initialCurrentQualification, initialServiceType),
  );
  const allowedTargets = getAllowedQualificationTargets(currentQualification, serviceType);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError("");
    setIsSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await learningRepository.saveQualificationProfile(
        {
          isActiveServiceMember: form.get("isActiveServiceMember") === "on",
          serviceType,
          personnelCategory: String(form.get("personnelCategory")) as PersonnelCategory,
          positionProfile: String(form.get("positionProfile")) as PositionProfile,
          hasSubordinates: form.get("hasSubordinates") === "on",
          serviceDirection: String(form.get("serviceDirection")) as ServiceDirection,
          serviceStartedAt: String(form.get("serviceStartedAt")),
          currentQualification,
          qualificationAwardedAt:
            currentQualification === "none" || !form.get("qualificationAwardedAt")
              ? null
              : String(form.get("qualificationAwardedAt")),
          qualificationExpiresAt:
            currentQualification === "none" || !form.get("qualificationExpiresAt")
              ? null
              : String(form.get("qualificationExpiresAt")),
          targetQualification,
        },
        user.id,
      );
      navigate("/qualification", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сохранить маршрут.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <span>Шаг 1 из 1</span>
            <h1>{profile ? "Изменить персональный маршрут" : "Настроим путь к классности"}</h1>
            <p>
              Укажите только обобщённые данные. Не вводите номер части, ВУС, должность,
              место службы и сведения ограниченного распространения.
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <section className={styles.card} aria-labelledby="service-title">
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div>
                  <h2 id="service-title">Общий профиль службы</h2>
                  <p>Эти данные нужны только для расчёта ориентировочного маршрута.</p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label>
                  <span>Вид прохождения службы</span>
                  <select
                    name="serviceType"
                    value={serviceType}
                    onChange={(event) => {
                      const nextType = event.target.value as ServiceType;
                      const nextCurrent = nextType === "conscript" && currentQualification === "master"
                        ? "none"
                        : currentQualification;
                      setServiceType(nextType);
                      setCurrentQualification(nextCurrent);
                      const nextAllowedTargets = getAllowedQualificationTargets(nextCurrent, nextType);
                      setTargetQualification((currentTarget) =>
                        nextAllowedTargets.includes(currentTarget)
                          ? currentTarget
                          : nextAllowedTargets.at(-1) ?? "third",
                      );
                    }}
                  >
                    <option value="contract">По контракту</option>
                    <option value="conscript">По призыву</option>
                  </select>
                </label>

                <label>
                  <span>Категория военнослужащего</span>
                  <select name="personnelCategory" defaultValue={profile?.personnelCategory ?? "soldier"}>
                    <option value="officer">Офицер</option>
                    <option value="warrant_officer">Прапорщик / мичман</option>
                    <option value="sergeant">Сержант / старшина</option>
                    <option value="soldier">Солдат / матрос</option>
                  </select>
                </label>

                <label>
                  <span>Обобщённый профиль должности</span>
                  <select name="positionProfile" defaultValue={profile?.positionProfile ?? "specialist"}>
                    <option value="leader">Руководитель</option>
                    <option value="specialist">Специалист</option>
                    <option value="primary">Первичная должность</option>
                  </select>
                </label>

                <label>
                  <span>Направление подготовки</span>
                  <select name="serviceDirection" defaultValue={profile?.serviceDirection ?? "general"}>
                    <option value="general">Общевойсковое</option>
                    <option value="command">Командное</option>
                    <option value="technical">Инженерно-техническое</option>
                    <option value="engineering">Инженерная подготовка</option>
                    <option value="communications">Связь и автоматизированные системы</option>
                    <option value="logistics">Материально-техническое обеспечение</option>
                    <option value="medical_support">Медицинское обеспечение</option>
                  </select>
                </label>

                <label>
                  <span>Дата начала службы</span>
                  <input
                    name="serviceStartedAt"
                    type="date"
                    defaultValue={profile?.serviceStartedAt ?? ""}
                    max={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>

                <label className={styles.checkbox}>
                  <input
                    name="hasSubordinates"
                    type="checkbox"
                    defaultChecked={profile?.hasSubordinates ?? false}
                  />
                  <span>В профиле должности есть подчинённые</span>
                </label>
              </div>
            </section>

            <section className={styles.card} aria-labelledby="qualification-title">
              <div className={styles.sectionHeading}>
                <span>02</span>
                <div>
                  <h2 id="qualification-title">Текущая и целевая классность</h2>
                  <p>Сервис построит учебный маршрут, но не заменяет официальное испытание.</p>
                </div>
              </div>

              <div className={styles.qualificationGrid}>
                <label>
                  <span>Текущая классная квалификация</span>
                  <select
                    name="currentQualification"
                    value={currentQualification}
                    onChange={(event) => {
                      const nextCurrent = event.target.value as QualificationLevel;
                      setCurrentQualification(nextCurrent);
                      const nextAllowedTargets = getAllowedQualificationTargets(nextCurrent, serviceType);
                      setTargetQualification((currentTarget) =>
                        nextAllowedTargets.includes(currentTarget)
                          ? currentTarget
                          : nextAllowedTargets.at(-1) ?? "third",
                      );
                    }}
                  >
                    <option value="none">Нет</option>
                    {qualificationOptions
                      .filter((option) => serviceType === "contract" || option.value !== "master")
                      .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <label>
                  <span>Цель маршрута</span>
                  <select
                    name="targetQualification"
                    value={targetQualification}
                    onChange={(event) => setTargetQualification(
                      event.target.value as Exclude<QualificationLevel, "none">,
                    )}
                    aria-describedby="target-qualification-note"
                  >
                    {qualificationOptions
                      .filter((option) => allowedTargets.includes(option.value))
                      .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                {currentQualification !== "none" && (
                  <>
                    <label>
                      <span>Дата присвоения</span>
                      <input
                        name="qualificationAwardedAt"
                        type="date"
                        defaultValue={profile?.qualificationAwardedAt ?? ""}
                      />
                    </label>
                    <label>
                      <span>Дата окончания срока</span>
                      <input
                        name="qualificationExpiresAt"
                        type="date"
                        defaultValue={profile?.qualificationExpiresAt ?? ""}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className={styles.qualificationHint} id="target-qualification-note">
                <strong>Как выбирается цель</strong>
                <span>
                  {currentQualification === "none"
                    ? "Если классности пока нет, доступна подготовка к 3-му классу."
                    : allowedTargets.length === 1
                      ? "Следующей ступени для этого вида службы нет — можно готовиться к подтверждению текущей классности."
                      : "Можно подтвердить текущую классность или готовиться к следующей ступени."}
                </span>
              </div>
            </section>

            {/* <aside className={styles.notice}>
              <strong>Важно</strong>
              <p>
                MVP строит обычный последовательный маршрут; исключительные решения комиссии не автоматизируются. Расчёты в приложении являются учебным прогнозом. Конкретный перечень предметов,
                допуск и присвоение классности определяются уполномоченными должностными лицами.
              </p>
            </aside> */}

            <label className={styles.confirmation}>
              <input
                name="isActiveServiceMember"
                type="checkbox"
                defaultChecked={profile?.isActiveServiceMember ?? false}
                required
              />
              <span>
                Подтверждаю, что использую приложение
                только для личной учебной подготовки.
              </span>
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              {profile && <Button text="Отмена" to="/qualification" variant="secondary" />}
              <Button text={isSaving ? "Сохраняем…" : "Построить маршрут"} type="submit" disabled={isSaving} />
            </div>
          </form>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
