import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { createServer } from "vite";

function stableUuid(key) {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 32).split("");
  hash[12] = "4";
  hash[16] = ["8", "9", "a", "b"][Number.parseInt(hash[16], 16) % 4];
  const value = hash.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function sqlText(value) {
  return value === null || value === undefined
    ? "null"
    : `'${String(value).replaceAll("'", "''")}'`;
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlTextArray(values) {
  return values.length === 0
    ? "'{}'::text[]"
    : `array[${values.map(sqlText).join(", ")}]::text[]`;
}

function valuesBlock(rows) {
  return rows.map((row) => `  (${row.join(", ")})`).join(",\n");
}

function subjectDbId(position) {
  return `10000000-0000-4000-8000-${String(position).padStart(12, "0")}`;
}

function moduleDbId(subjectPosition, moduleNumber) {
  return `${20 + subjectPosition}000000-0000-4000-8000-${String(moduleNumber).padStart(12, "0")}`;
}

const vite = await createServer({
  appType: "custom",
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
});

try {
  const { curriculumSources, sourceBasedCurriculum } = await vite.ssrLoadModule(
    "/app/data/curriculum-content.ts",
  );

  const catalog = [
    { id: "medical", code: "01", slug: "medical-training", title: "Медицинская подготовка", theme: "blue", position: 1, progressMinutes: 0 },
    { id: "firearms", code: "02", slug: "firearms-training", title: "Огневая подготовка", subtitle: "Теория • безопасность", description: "Безопасность, устройство и порядок действий.", theme: "blue", position: 2, progressMinutes: 150 },
    { id: "rhb", code: "03", slug: "rhb-protection", title: "РХБ защита", theme: "olive", position: 3, progressMinutes: 0 },
    { id: "tactics", code: "04", slug: "tactical-training", title: "Тактическая подготовка", subtitle: "Теория • взаимодействие", description: "Наблюдение, передвижение и взаимодействие.", theme: "olive", position: 4, progressMinutes: 175 },
    { id: "topography", code: "05", slug: "military-topography", title: "Военная топография", theme: "blue", position: 5, progressMinutes: 0 },
    { id: "engineering", code: "06", slug: "engineering-training", title: "Инженерная подготовка", subtitle: "Общие положения", description: "Общие положения и инженерные средства.", theme: "blue", position: 6, progressMinutes: 100 },
    { id: "regulations", code: "07", slug: "military-regulations", title: "Общевоинские уставы", theme: "olive", position: 7, progressMinutes: 0 },
  ];

  const placeholderModules = {
    firearms: ["Меры безопасности", "Основы устройства", "Подготовка к применению", "Положения", "Практические сценарии", "Контроль знаний"],
    tactics: ["Основы тактики", "Наблюдение", "Передвижение", "Взаимодействие", "Организация действий", "Сценарии", "Итоговый тест"],
    engineering: ["Общие положения", "Инженерные средства", "Оборудование позиций", "Итоговый тест"],
  };

  const subjects = catalog.map((subject) => {
    const curriculum = sourceBasedCurriculum[subject.id];
    const estimatedMinutes = curriculum
      ? curriculum.modules.reduce((sum, module) => sum + module.estimatedMinutes, 0)
      : subject.progressMinutes;
    return {
      ...subject,
      subtitle: curriculum?.subtitle ?? subject.subtitle,
      description: curriculum?.description ?? subject.description,
      estimatedMinutes,
      dbId: subjectDbId(subject.position),
    };
  });

  const modules = subjects.flatMap((subject) => {
    const curriculum = sourceBasedCurriculum[subject.id];
    if (curriculum) {
      return curriculum.modules.map((module) => ({
        ...module,
        subjectId: subject.id,
        subjectDbId: subject.dbId,
        dbId: moduleDbId(subject.position, module.number),
      }));
    }
    return placeholderModules[subject.id].map((title, index) => ({
      number: index + 1,
      title,
      summary: title.toLocaleLowerCase("ru").includes("итог") || title === "Контроль знаний"
        ? "Итоговый тест"
        : "Теория + тест",
      estimatedMinutes: 25,
      objective: null,
      keyPrinciple: null,
      shortSummary: null,
      learningTip: null,
      sections: [],
      questions: [1, 2, 3].map((position) => ({
        prompt: `Учебный вопрос ${position} по теме «${title}»`,
        hint: "Вспомните цель и основные положения модуля.",
        options: [
          "Сначала оценить условия, свериться с изученным порядком и только затем действовать",
          "Пропустить оценку условий и сразу перейти к действию",
          "Выбрать действие только по скорости выполнения",
          "Не учитывать ограничения и цель задания",
        ],
        correctIndex: 0,
        explanation: "Временный учебный ключ проверяет общую логику: оценка условий предшествует действию.",
      })),
      sourceKeys: [],
      sourceLocator: "",
      subjectId: subject.id,
      subjectDbId: subject.dbId,
      dbId: moduleDbId(subject.position, index + 1),
    }));
  });

  const activities = modules.flatMap((module) => {
    const base = [
      {
        id: stableUuid(`activity:${module.dbId}:theory`),
        moduleId: module.dbId,
        type: "theory",
        title: "Теория",
        description: "Теоретический материал",
        position: 1,
        estimatedMinutes: Math.max(10, Math.round(module.estimatedMinutes * 0.55)),
        prompt: null,
        instructions: null,
        hint: null,
        maxLength: null,
      },
      {
        id: stableUuid(`activity:${module.dbId}:quiz`),
        moduleId: module.dbId,
        type: "quiz",
        title: module.summary === "Итоговый тест" ? "Итоговая проверка" : "Проверка знаний",
        description: `Тест по теме «${module.title}»`,
        position: 2,
        estimatedMinutes: Math.max(8, Math.round(module.estimatedMinutes * 0.35)),
        prompt: null,
        instructions: null,
        hint: "Ответьте на все вопросы перед отправкой.",
        maxLength: null,
      },
    ];
    if (module.freeAnswer) {
      base.push({
        id: stableUuid(`activity:${module.dbId}:free-answer`),
        moduleId: module.dbId,
        type: "free_answer",
        title: module.freeAnswer.title,
        description: module.freeAnswer.description,
        position: 3,
        estimatedMinutes: Math.max(12, module.estimatedMinutes - base[0].estimatedMinutes - base[1].estimatedMinutes),
        prompt: module.freeAnswer.prompt,
        instructions: module.freeAnswer.instructions,
        hint: null,
        maxLength: module.freeAnswer.maxLength,
      });
    }
    return base;
  });

  const activityByModuleAndType = new Map(
    activities.map((activity) => [`${activity.moduleId}:${activity.type}`, activity]),
  );

  const sections = modules.flatMap((module) => module.sections.map((section, index) => ({
    id: stableUuid(`section:${module.dbId}:${index + 1}`),
    moduleId: module.dbId,
    title: section.title,
    body: section.body,
    position: index + 1,
  })));

  const questions = modules.flatMap((module) => {
    const quiz = activityByModuleAndType.get(`${module.dbId}:quiz`);
    return module.questions.map((item, index) => ({
      ...item,
      id: stableUuid(`question:${module.dbId}:${index + 1}`),
      activityId: quiz.id,
      position: index + 1,
    }));
  });

  const options = questions.flatMap((question) => question.options.map((text, index) => ({
    id: stableUuid(`option:${question.id}:${index + 1}`),
    questionId: question.id,
    label: String.fromCharCode(65 + index),
    text,
    position: index + 1,
  })));
  const optionByQuestionAndPosition = new Map(
    options.map((option) => [`${option.questionId}:${option.position}`, option]),
  );

  const criteria = modules.flatMap((module) => {
    if (!module.freeAnswer) return [];
    const activity = activityByModuleAndType.get(`${module.dbId}:free_answer`);
    return module.freeAnswer.criteria.map((criterion, index) => ({
      ...criterion,
      id: stableUuid(`criterion:${activity.id}:${index + 1}`),
      activityId: activity.id,
      position: index + 1,
    }));
  });
  const rubrics = modules.flatMap((module) => {
    if (!module.freeAnswer) return [];
    const activity = activityByModuleAndType.get(`${module.dbId}:free_answer`);
    return [{
      activityId: activity.id,
      referenceAnswerPoints: module.freeAnswer.referenceAnswerPoints,
    }];
  });

  const sourceRows = curriculumSources.map((source) => ({
    ...source,
    id: stableUuid(`source:${source.key}`),
    subjectDbId: subjects.find((subject) => subject.id === source.subjectId).dbId,
  }));
  const sourceByKey = new Map(sourceRows.map((source) => [source.key, source]));
  const sourceReferences = modules.flatMap((module) => module.sourceKeys.map((sourceKey) => ({
    moduleId: module.dbId,
    sourceId: sourceByKey.get(sourceKey).id,
    locator: module.sourceLocator,
  })));

  const sql = [
    "-- GENERATED FILE. Edit app/data/curriculum-content.ts and run npm run content:seed.",
    "-- The three subjects without supplied sources intentionally keep placeholder content.",
    "begin;",
    "",
    "insert into public.subjects (id, code, slug, title, subtitle, theme, position, estimated_minutes, description, is_published)",
    "values",
    valuesBlock(subjects.map((subject) => [
      sqlText(subject.dbId), sqlText(subject.code), sqlText(subject.slug), sqlText(subject.title),
      sqlText(subject.subtitle), sqlText(subject.theme), subject.position, subject.estimatedMinutes,
      sqlText(subject.description), "true",
    ])) + ";",
    "",
    "insert into public.modules (id, subject_id, title, position, is_published, summary, estimated_minutes, objective, key_principle, short_summary, learning_tip)",
    "values",
    valuesBlock(modules.map((module) => [
      sqlText(module.dbId), sqlText(module.subjectDbId), sqlText(module.title), module.number, "true",
      sqlText(module.summary), module.estimatedMinutes, sqlText(module.objective), sqlText(module.keyPrinciple),
      sqlText(module.shortSummary), sqlText(module.learningTip),
    ])) + ";",
    "",
    "insert into public.learning_activities (id, module_id, type, title, description, position, estimated_minutes, prompt, instructions, hint, max_length, is_published)",
    "values",
    valuesBlock(activities.map((activity) => [
      sqlText(activity.id), sqlText(activity.moduleId), `${sqlText(activity.type)}::public.activity_type`,
      sqlText(activity.title), sqlText(activity.description), activity.position, activity.estimatedMinutes,
      sqlText(activity.prompt), sqlText(activity.instructions), sqlText(activity.hint), activity.maxLength ?? "null", "true",
    ])) + ";",
    "",
    "insert into public.module_sections (id, module_id, title, body, position)",
    "values",
    valuesBlock(sections.map((section) => [
      sqlText(section.id), sqlText(section.moduleId), sqlText(section.title), sqlText(section.body), section.position,
    ])) + ";",
    "",
    "insert into public.activity_questions (id, activity_id, prompt, instructions, hint, position)",
    "values",
    valuesBlock(questions.map((item) => [
      sqlText(item.id), sqlText(item.activityId), sqlText(item.prompt), sqlText("Выберите один вариант."),
      sqlText(item.hint), item.position,
    ])) + ";",
    "",
    "insert into public.question_options (id, question_id, label, text, position)",
    "values",
    valuesBlock(options.map((option) => [
      sqlText(option.id), sqlText(option.questionId), sqlText(option.label), sqlText(option.text), option.position,
    ])) + ";",
    "",
    "insert into public.question_answer_keys (question_id, correct_option_id, explanation)",
    "values",
    valuesBlock(questions.map((item) => [
      sqlText(item.id),
      sqlText(optionByQuestionAndPosition.get(`${item.id}:${item.correctIndex + 1}`).id),
      sqlText(item.explanation),
    ])) + ";",
    "",
    "insert into public.evaluation_criteria (id, activity_id, title, weight_percent, position, guidance, required_concepts)",
    "values",
    valuesBlock(criteria.map((criterion) => [
      sqlText(criterion.id), sqlText(criterion.activityId), sqlText(criterion.title), criterion.weightPercent,
      criterion.position, sqlText(criterion.guidance), sqlTextArray(criterion.requiredConcepts),
    ])) + ";",
    "",
    "insert into public.free_answer_rubrics (activity_id, reference_answer_points)",
    "values",
    valuesBlock(rubrics.map((rubric) => [
      sqlText(rubric.activityId), sqlTextArray(rubric.referenceAnswerPoints),
    ])) + ";",
    "",
    "insert into public.content_sources (id, source_key, subject_id, title, kind, file_name, uri, version_label, published_on, verified_at, is_current_verified, notes)",
    "values",
    valuesBlock(sourceRows.map((source) => [
      sqlText(source.id), sqlText(source.key), sqlText(source.subjectDbId), sqlText(source.title),
      `${sqlText(source.kind)}::public.content_source_kind`, sqlText(source.fileName), sqlText(source.uri),
      sqlText(source.versionLabel), sqlText(source.publishedOn), sqlText(source.verifiedAt),
      sqlBoolean(source.isCurrentVerified), sqlText(source.notes),
    ])) + ";",
    "",
    "insert into public.module_content_sources (module_id, source_id, locator)",
    "values",
    valuesBlock(sourceReferences.map((reference) => [
      sqlText(reference.moduleId), sqlText(reference.sourceId), sqlText(reference.locator),
    ])) + ";",
    "",
    "commit;",
    "",
  ].join("\n");

  const outputPath = path.resolve(process.cwd(), "supabase", "seed.sql");
  if (process.argv.includes("--check")) {
    const currentSql = readFileSync(outputPath, "utf8");
    if (currentSql !== sql) {
      throw new Error("supabase/seed.sql is out of date. Run `npm run content:seed`.");
    }
  } else {
    writeFileSync(outputPath, sql, "utf8");
  }
  console.log(
    `${process.argv.includes("--check") ? "Verified" : "Generated"} ${outputPath}: ` +
      `${subjects.length} subjects, ${modules.length} modules, ` +
      `${sections.length} sections, ${questions.length} questions, ${criteria.length} criteria.`,
  );
} finally {
  await vite.close();
}
