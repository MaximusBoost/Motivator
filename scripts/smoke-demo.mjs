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

  const physicalResult = await repository.savePracticeResult({
    category: "physical",
    subjectId: null,
    title: "Контрольный норматив",
    value: 12.4,
    unit: "мин",
    grade: 4,
    performedAt: "2026-08-17",
    notes: null,
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

  const ordinaryQuiz = subjects[0].modules
    .flatMap((module) => module.activities)
    .find((activity) => activity.type === "quiz");
  assert(ordinaryQuiz, "Ordinary quiz is missing");
  const quizAnswers = Object.fromEntries(ordinaryQuiz.questions.map((question) => [
    question.id,
    correctOption(question),
  ]));
  const quizResult = await repository.submitQuiz(ordinaryQuiz.id, quizAnswers, userId);
  assert(quizResult.score === 100, "Ordinary quiz scoring failed");

  const freeAnswer = subjects[0].modules
    .flatMap((module) => module.activities)
    .find((activity) => activity.type === "free_answer");
  assert(freeAnswer, "Free-answer activity is missing");
  const freeResult = await repository.submitFreeAnswer(
    freeAnswer.id,
    "Сначала оцениваю условия и риски, затем определяю приоритет и проверяю решение.",
    userId,
  );
  assert(freeResult.score > 0, "Demo free-answer check failed");

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
