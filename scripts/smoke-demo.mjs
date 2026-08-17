import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejects(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

globalThis.window = {
  crypto: globalThis.crypto,
  localStorage: new MemoryStorage(),
};

globalThis.fetch = async (url, init) => {
  if (String(url) !== "/api/ai/review-free-answer") {
    throw new Error(`Unexpected demo smoke request: ${String(url)}`);
  }
  const request = JSON.parse(String(init?.body ?? "{}"));
  const criterionScores = [1, 2, 3, 4].map((position) => ({
    criterionId: `${request.activityId}-criterion-${position}`,
    score: 80 + position,
    feedback: `Тестовый комментарий по критерию ${position}.`,
  }));
  return new Response(JSON.stringify({
    activityId: request.activityId,
    provider: "gigachat",
    model: "GigaChat-test",
    score: 83,
    summary: "Тестовая серверная AI-проверка.",
    criterionScores,
    feedback: {
      strength: "Тестовая сильная сторона.",
      improvement: "Тестовое улучшение.",
      recommendation: "Тестовая рекомендация.",
    },
    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const vite = await createServer({
  appType: "custom",
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
});

try {
  const { mockLearningRepository: repository } = await vite.ssrLoadModule(
    "/app/data/repositories/mock-learning.repository.ts",
  );
  const { getCurriculumCorrectOptionLabel, sourceBasedCurriculum } = await vite.ssrLoadModule(
    "/app/data/curriculum-content.ts",
  );
  const correctOption = (question) => {
    const [moduleId, positionText] = question.id.split("-quiz-q");
    const label = getCurriculumCorrectOptionLabel(moduleId, Number(positionText)) ?? "A";
    return question.options.find((option) => option.label === label)?.id;
  };
  const userId = "smoke-user";
  const initialDashboard = await repository.getDashboard(userId);
  assert(initialDashboard.featuredSubjects.length > 0, "Dashboard subjects are missing");

  await assertRejects(
    () => repository.saveQualificationProfile({
      isActiveServiceMember: false,
      serviceType: "contract",
      personnelCategory: "soldier",
      positionProfile: "specialist",
      hasSubordinates: false,
      serviceDirection: "general",
      serviceStartedAt: "2024-01-01",
      currentQualification: "none",
      qualificationAwardedAt: null,
      qualificationExpiresAt: null,
      targetQualification: "third",
    }, userId),
    "Inactive-service profile must be rejected",
  );

  await assertRejects(
    () => repository.saveQualificationProfile({
      isActiveServiceMember: true,
      serviceType: "conscript",
      personnelCategory: "soldier",
      positionProfile: "specialist",
      hasSubordinates: false,
      serviceDirection: "general",
      serviceStartedAt: "2024-01-01",
      currentQualification: "none",
      qualificationAwardedAt: null,
      qualificationExpiresAt: null,
      targetQualification: "master",
    }, userId),
    "Conscript master target must be rejected",
  );

  const qualificationChoiceUserId = "qualification-choice-user";
  const qualificationChoiceProfile = {
    isActiveServiceMember: true,
    serviceType: "contract",
    personnelCategory: "soldier",
    positionProfile: "specialist",
    hasSubordinates: false,
    serviceDirection: "general",
    serviceStartedAt: "2024-01-01",
    currentQualification: "third",
    qualificationAwardedAt: "2025-01-01",
    qualificationExpiresAt: "2026-12-31",
  };
  await repository.saveQualificationProfile({
    ...qualificationChoiceProfile,
    targetQualification: "third",
  }, qualificationChoiceUserId);
  assert(
    (await repository.getQualificationProfile(qualificationChoiceUserId))?.targetQualification === "third",
    "Current qualification must be available as a confirmation target",
  );
  await repository.saveQualificationProfile({
    ...qualificationChoiceProfile,
    targetQualification: "second",
  }, qualificationChoiceUserId);
  assert(
    (await repository.getQualificationProfile(qualificationChoiceUserId))?.targetQualification === "second",
    "The next sequential qualification must be available as a target",
  );
  await assertRejects(
    () => repository.saveQualificationProfile({
      ...qualificationChoiceProfile,
      targetQualification: "first",
    }, qualificationChoiceUserId),
    "Skipping a qualification level must be rejected",
  );

  await repository.saveQualificationProfile({
    isActiveServiceMember: true,
    serviceType: "contract",
    personnelCategory: "soldier",
    positionProfile: "specialist",
    hasSubordinates: false,
    serviceDirection: "general",
    serviceStartedAt: "2024-01-01",
    currentQualification: "none",
    qualificationAwardedAt: null,
    qualificationExpiresAt: null,
    targetQualification: "third",
  }, userId);
  const smokeBirthYear = new Date().getFullYear() - 32;
  await repository.savePhysicalProfile({
    sex: "male",
    birthDate: `${smokeBirthYear}-01-01`,
    assessmentCategory: 3,
    targetLevel: "highest",
  }, userId);

  const subjects = await repository.getSubjects(userId);
  assert(subjects.length === 7, `Expected 7 subjects, received ${subjects.length}`);

  const sourceBasedSubjectIds = Object.keys(sourceBasedCurriculum);
  const sourceBasedSubjects = subjects.filter((subject) => sourceBasedSubjectIds.includes(subject.id));
  assert(sourceBasedSubjects.length === 4, "Exactly four subjects must contain source-based content");
  const sourceBasedModules = sourceBasedSubjects.flatMap((subject) => subject.modules);
  assert(sourceBasedModules.length === 25, "Source-based curriculum must contain 25 modules");
  assert(
    sourceBasedModules.every((module) => module.sections.length >= 2),
    "Every source-based module must contain theory sections",
  );
  assert(
    sourceBasedModules.every((module) => module.sources.length > 0),
    "Every source-based module must expose its source references",
  );
  assert(
    sourceBasedModules.flatMap((module) => module.sources).some((source) => source.uri),
    "Source references must include official links",
  );
  const sourceBasedQuestions = sourceBasedModules.flatMap((module) =>
    module.activities
      .filter((activity) => activity.type === "quiz")
      .flatMap((activity) => activity.questions),
  );
  assert(sourceBasedQuestions.length === 75, "Source-based curriculum must contain 75 questions");
  assert(
    sourceBasedModules.every((module) => module.activities.some((activity) =>
      activity.type === "quiz" && activity.questions.length === 3
    )),
    "Every source-based module must contain a three-question test",
  );
  const sourceBasedFreeAnswers = sourceBasedModules.flatMap((module) =>
    module.activities.filter((activity) => activity.type === "free_answer"),
  );
  assert(sourceBasedFreeAnswers.length === 7, "Expected seven source-grounded free-answer tasks");
  assert(
    sourceBasedFreeAnswers.every((activity) =>
      activity.criteria.reduce((sum, criterion) => sum + criterion.weightPercent, 0) === 100
    ),
    "Every free-answer rubric must total 100%",
  );
  const correctLabels = new Set(sourceBasedQuestions.map((question) => {
    const [moduleId, positionText] = question.id.split("-quiz-q");
    return getCurriculumCorrectOptionLabel(moduleId, Number(positionText));
  }));
  assert(correctLabels.size === 4, "Correct answers must be distributed across A-D");

  const recentlyStudiedSubject = subjects.find((subject) => subject.id === "topography");
  const recentlyStartedQuiz = recentlyStudiedSubject?.modules
    .flatMap((module) => module.activities)
    .find((activity) => activity.type === "quiz");
  assert(recentlyStudiedSubject && recentlyStartedQuiz, "Recent-subject fixture is missing");
  await repository.saveQuizProgress(
    recentlyStartedQuiz.id,
    1,
    recentlyStartedQuiz.questions.length,
    userId,
  );
  const recentDashboard = await repository.getDashboard(userId);
  assert(
    recentDashboard.continueLearning?.subjectId === recentlyStudiedSubject.id,
    "Dashboard must continue the most recently studied subject",
  );
  const openedSubject = subjects.find((subject) => subject.id === "regulations");
  const openedTheory = openedSubject?.modules
    .flatMap((module) => module.activities)
    .find((activity) => activity.type === "theory");
  assert(openedSubject && openedTheory, "Opened-subject fixture is missing");
  await repository.startActivity(openedTheory.id, userId);
  const dashboardAfterOpeningTheory = await repository.getDashboard(userId);
  assert(
    dashboardAfterOpeningTheory.continueLearning?.subjectId === openedSubject.id,
    "Opening theory must make its subject the current dashboard subject",
  );

  await assertRejects(
    () => repository.savePracticeResult({
      category: "physical",
      subjectId: null,
      title: "Некорректный норматив",
      value: -1,
      unit: "мин",
      grade: 2,
      performedAt: "2026-08-17",
      notes: null,
    }, userId),
    "Negative practice result must be rejected",
  );

  await repository.savePracticeResult({
    category: "physical",
    subjectId: null,
    title: "Сгибание и разгибание рук в упоре лёжа",
    value: 38,
    unit: "раз",
    grade: 4,
    performedAt: "2026-08-17",
    notes: null,
    physicalExerciseId: "push_ups",
    physicalQuality: "strength",
    points: 50,
    ageGroup: 3,
  }, userId);
  await repository.savePracticeResult({
    category: "physical",
    subjectId: null,
    title: "Бег на 100 м",
    value: 14.1,
    unit: "s",
    grade: 4,
    performedAt: "2026-08-17",
    notes: null,
    physicalExerciseId: "run_100m",
    physicalQuality: "speed",
    points: 50,
    ageGroup: 3,
  }, userId);
  const physicalResult = await repository.savePracticeResult({
    category: "physical",
    subjectId: null,
    title: "Контрольный норматив",
    value: 224,
    unit: "s",
    grade: 4,
    performedAt: "2026-08-17",
    notes: null,
    physicalExerciseId: "run_1km",
    physicalQuality: "endurance",
    points: 50,
    ageGroup: 3,
  }, userId);
  await repository.savePracticeResult({
    category: "professional",
    subjectId: subjects[0].id,
    title: "Практическое упражнение",
    value: 8,
    unit: "баллов",
    grade: 4,
    performedAt: "2026-08-17",
    notes: "Smoke test",
  }, userId);

  const advice = await repository.getPhysicalTrainingAdvice(userId);
  assert(advice?.basedOnResultId === physicalResult.id, "Physical advice was not generated");

  const exam = await repository.createQualificationExam(
    subjects.slice(0, 4).map((subject) => subject.id),
    userId,
  );
  await assertRejects(
    () => repository.createQualificationExam(subjects.slice(0, 3).map((subject) => subject.id), userId),
    "Qualification exam with fewer than four subjects must be rejected",
  );
  assert(exam.subjects.length === 4, "Qualification exam has wrong subject count");
  assert(
    exam.subjects.every((subject) => subject.questions.length === 10),
    "Qualification exam must have 10 questions per subject",
  );
  const examAnswers = Object.fromEntries(
    exam.subjects.flatMap((subject) => subject.questions.map((question) => [
      question.id,
      correctOption(question),
    ])),
  );
  assert(Object.values(examAnswers).every(Boolean), "Qualification answer options are missing");
  const [firstQuestionId] = Object.keys(examAnswers);
  const incompleteExamAnswers = { ...examAnswers };
  delete incompleteExamAnswers[firstQuestionId];
  await assertRejects(
    () => repository.submitQualificationExam(exam, incompleteExamAnswers, userId),
    "Incomplete qualification exam must be rejected",
  );
  const examResult = await repository.submitQualificationExam(exam, examAnswers, userId);
  assert(examResult.qualifiesForTarget, "Perfect qualification exam did not reach target");
  assert(examResult.subjectResults.every((result) => result.grade === 5), "Perfect answers must grade as 5");

  const freeAnswerModule = subjects[0].modules.find((module) =>
    module.activities.some((activity) => activity.type === "free_answer"),
  );
  assert(freeAnswerModule, "Module with a free-answer activity is missing");
  const freeAnswer = freeAnswerModule.activities.find(
    (activity) => activity.type === "free_answer",
  );
  assert(freeAnswer, "Free-answer activity is missing");
  assert(
    !(await repository.isFreeAnswerUnlocked(freeAnswer.id, userId)),
    "Free answer must be locked before the module quiz",
  );
  await assertRejects(
    () => repository.submitFreeAnswer(
      freeAnswer.id,
      "Сначала оцениваю условия и риски, затем определяю приоритет и проверяю решение.",
      userId,
    ),
    "Free answer submission must be rejected before the module quiz",
  );

  const ordinaryQuiz = freeAnswerModule.activities.find((activity) => activity.type === "quiz");
  assert(ordinaryQuiz, "Ordinary quiz is missing");
  const quizAnswers = Object.fromEntries(ordinaryQuiz.questions.map((question) => [
    question.id,
    correctOption(question),
  ]));
  const quizResult = await repository.submitQuiz(ordinaryQuiz.id, quizAnswers, userId);
  assert(quizResult.score === 100, "Ordinary quiz scoring failed");
  assert(
    await repository.isFreeAnswerUnlocked(freeAnswer.id, userId),
    "Free answer must unlock after the module quiz",
  );
  const freeResult = await repository.submitFreeAnswer(
    freeAnswer.id,
    "Сначала оцениваю условия и риски, затем определяю приоритет и проверяю решение.",
    userId,
  );
  assert(freeResult.score === 83, "Demo free-answer API result was not stored");
  assert(freeResult.aiFeedback?.strength, "Demo free-answer AI feedback is missing");
  assert(
    freeResult.criterionScores.every((criterion) => criterion.feedback),
    "Demo criterion feedback is missing",
  );

  const roadmap = await repository.getQualificationRoadmap(userId);
  assert(roadmap.profile?.targetQualification === "third", "Roadmap profile is missing");
  assert(roadmap.latestExam?.id === examResult.id, "Latest qualification result is missing");
  assert(roadmap.physicalGrade === 4, "Physical grade did not reach roadmap");

  const firstPlanItem = initialDashboard.todayPlan[0];
  assert(firstPlanItem, "Today plan is empty");
  await repository.setTodayPlanItemCompleted(firstPlanItem.id, true, userId);
  const updatedDashboard = await repository.getDashboard(userId);
  assert(
    updatedDashboard.todayPlan.find((item) => item.id === firstPlanItem.id)?.isCompleted,
    "Today plan toggle was not saved",
  );

  console.log("Demo smoke test passed: auth-independent user journey is operational.");
} finally {
  await vite.close();
}
