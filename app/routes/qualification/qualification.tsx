import type { CSSProperties } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/qualification";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import {
  QUALIFICATION_POLICY_SOURCE,
  qualificationBonusPercent,
  qualificationLabels,
  serviceDirectionLabels,
} from "~/data/qualification-policy";
import {
  PHYSICAL_POLICY_SOURCE,
  physicalQualificationLabels,
} from "~/data/physical-training-policy";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./qualification.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Мой маршрут | Motivator" }];
}

export async function clientLoader() {
  return learningRepository.getQualificationRoadmap(await getCurrentUserId());
}

const statusLabels = {
  not_started: "Не начато",
  in_progress: "В работе",
  ready: "Готово",
  blocked: "Есть ограничение",
} as const;

export default function Qualification({ loaderData: roadmap }: Route.ComponentProps) {
  const profile = roadmap.profile;
  const readinessFactors = [
    { label: "Обучение", weight: 45, value: roadmap.learningReadinessPercent },
    { label: "Пробный экзамен", weight: 35, value: roadmap.examReadinessPercent },
    { label: "Практика", weight: 10, value: roadmap.practiceReadinessPercent },
    {
      label: "Физподготовка",
      weight: 10,
      value: roadmap.requirements.find((requirement) => requirement.id === "physical")?.progressPercent ?? 0,
    },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <span>Персональная траектория</span>
              <h1>Мой маршрут</h1>
              <p>Две связанные цели: ближайший квалификационный класс и уровень физической подготовленности.</p>
            </div>
            {profile && <Button text="Изменить цель" to="/onboarding" variant="secondary" />}
          </header>

          {!profile ? (
            <section className={styles.emptyState}>
              <span aria-hidden="true">01</span>
              <div>
                <h2>Сначала выберите цель</h2>
                <p>Заполните обобщённый профиль службы, чтобы приложение смогло построить маршрут.</p>
                <Button text="Настроить маршрут" to="/onboarding" />
              </div>
            </section>
          ) : (
            <>
              <section className={styles.heroGrid}>
                <article className={styles.readinessCard}>
                  <div
                    className={styles.readinessRing}
                    style={{ "--progress-angle": `${roadmap.readinessPercent * 3.6}deg` } as CSSProperties}
                    aria-label={`Сводный учебный индекс маршрута ${roadmap.readinessPercent}%`}
                  >
                    <strong>{roadmap.readinessPercent}%</strong>
                    <span>индекс маршрута</span>
                  </div>
                  <div className={styles.readinessContent}>
                    <span className={styles.eyebrow}>Цель по классности</span>
                    <h2>{qualificationLabels[profile.targetQualification]}</h2>
                    <p>{roadmap.eligibilityLabel}</p>
                    <strong className={styles.bonus}>+{qualificationBonusPercent[profile.targetQualification]}% к окладу по воинской должности</strong>
                    <ul className={styles.readinessFactors} aria-label="Состав общего индекса маршрута">
                      
                    </ul>
                  </div>
                </article>

                <article className={styles.physicalGoalCard}>
                  <div
                    className={styles.smallReadinessRing}
                    style={{ "--progress-angle": `${(roadmap.physical.assessment?.progressPercent ?? 0) * 3.6}deg` } as CSSProperties}
                    aria-label={`Готовность к физической цели ${roadmap.physical.assessment?.progressPercent ?? 0}%`}
                  >
                    <strong>{roadmap.physical.assessment?.progressPercent ?? 0}%</strong>
                  </div>
                  <div>
                    <span className={styles.eyebrow}>Цель по физподготовке</span>
                    <h2>
                      {roadmap.physical.profile
                        ? physicalQualificationLabels[roadmap.physical.profile.targetLevel]
                        : "Настройте цель"}
                    </h2>
                    <p>
                      {roadmap.physical.assessment?.preliminaryLevel
                        ? `Предварительно: ${physicalQualificationLabels[roadmap.physical.assessment.preliminaryLevel]}.`
                        : roadmap.physical.assessment
                          ? `Собрано ${roadmap.physical.assessment.countedExerciseCount} из ${roadmap.physical.assessment.requiredExerciseCount} физических качеств.`
                          : "Добавьте пол, дату рождения, категорию и результаты упражнений."}
                    </p>
                    {roadmap.physical.profile && (
                      <strong className={styles.bonus}>
                        {profile.serviceType === "contract"
                          ? roadmap.physical.targetBonusPercent > 0
                            ? `+${roadmap.physical.targetBonusPercent}% к окладу по воинской должности`
                            : "Для третьего уровня отдельный процент надбавки не показывается"
                          : "Для службы по призыву денежная надбавка не рассчитывается"}
                      </strong>
                    )}
                    <Button text={roadmap.physical.profile ? "Открыть программу" : "Настроить физподготовку"} to="/practice" size="s" variant="secondary" />
                  </div>
                </article>
              </section>

              <article className={`${styles.forecastCard} ${styles.forecastWide}`}>
                  <span className={styles.eyebrow}>Последнее пробное квалификационное испытание</span>
                  <strong>
                    {roadmap.latestExam
                      ? `Учебный прогноз: ${qualificationLabels[roadmap.predictedQualification]}`
                      : "Результата пока нет"}
                  </strong>
                  <p>
                    {roadmap.latestExam
                      ? `Средний результат по предметам — ${roadmap.latestExam.averageScorePercent}%. Это итог последнего запуска пробного экзамена внутри приложения, а не решение квалификационной комиссии.`
                      : "Пройдите пробный экзамен внутри приложения, чтобы проверить знания по предметам и получить учебный прогноз."}
                  </p>
                  <Button text={roadmap.latestExam ? "Пройти ещё раз" : "Пройти пробный экзамен"} to="/qualification/exam" size="s" />
              </article>

              <section className={styles.profileStrip} aria-label="Параметры маршрута">
                <div><span>Направление</span><strong>{serviceDirectionLabels[profile.serviceDirection]}</strong></div>
                <div><span>Служба</span><strong>{profile.serviceType === "contract" ? "По контракту" : "По призыву"}</strong></div>
                <div><span>Текущая классность</span><strong>{qualificationLabels[profile.currentQualification]}</strong></div>
                <div><span>Физподготовка</span><strong>{roadmap.physicalGrade ? `Итоговая оценка ${roadmap.physicalGrade}` : "Комплекс не собран"}</strong></div>
              </section>

              {roadmap.blockers.length > 0 && (
                <section className={styles.blockers} aria-labelledby="blockers-title">
                  <div>
                    <span aria-hidden="true">!</span>
                    <h2 id="blockers-title">Что сейчас мешает достичь цели</h2>
                  </div>
                  <ul>
                    {roadmap.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                  </ul>
                </section>
              )}

              <section className={styles.section} aria-labelledby="steps-title">
                <div className={styles.sectionTitle}>
                  <div>
                    <span>План действий</span>
                    <h2 id="steps-title">Ближайшие этапы</h2>
                  </div>
                </div>
                <div className={styles.requirementGrid}>
                  {roadmap.requirements.map((requirement, index) => (
                    <Link className={styles.requirementCard} to={requirement.href} key={requirement.id}>
                      <div className={styles.requirementTop}>
                        <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                        <span className={`${styles.status} ${styles[requirement.status]}`}>
                          {statusLabels[requirement.status]}
                        </span>
                      </div>
                      <h3>{requirement.title}</h3>
                      <p>{requirement.description}</p>
                      <ProgressTrack value={requirement.progressPercent} />
                      <strong className={styles.openLink}>Открыть этап →</strong>
                    </Link>
                  ))}
                </div>
              </section>

              <section className={styles.section} aria-labelledby="subjects-title">
                <div className={styles.sectionTitle}>
                  <div>
                    <span>Базовое ядро</span>
                    <h2 id="subjects-title">Готовность по предметам</h2>
                  </div>
                  <Button text="Все предметы" to="/subjects" variant="secondary" size="s" />
                </div>
                <div className={styles.subjectList}>
                  {roadmap.subjects.map((subject) => (
                    <div className={styles.subjectRow} key={subject.subjectId}>
                      <div>
                        <div className={styles.subjectTitle}>
                          <strong>{subject.title}</strong>
                          <span className={styles.priorityBadge}>
                            {subject.preparationPriority === "core"
                              ? "База"
                              : subject.preparationPriority === "profile" ? "Ваш профиль" : "Дополнительно"}
                          </span>
                        </div>
                        <span>{subject.lastScore === null ? "Нет контрольного результата" : `Последний тест: ${subject.lastScore}%`}</span>
                      </div>
                      <div className={styles.subjectProgress}>
                        <ProgressTrack value={subject.readinessPercent} />
                        <strong>{subject.readinessPercent}%</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <footer className={styles.disclaimer}>
            <strong>Учебный сервис, не официальный допуск.</strong>
            <p>
              Основа расчёта: {QUALIFICATION_POLICY_SOURCE}. Перечень предметов и результаты в приложении
              не подтверждают присвоение классности и требуют сверки с действующими документами и решением комиссии.
              Физическая подготовка: {PHYSICAL_POLICY_SOURCE}. Проценты показаны как мотивационный ориентир;
              право на выплату возникает только по официально оформленным результатам и должно подтверждаться финансовым органом.
            </p>
          </footer>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
