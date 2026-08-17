# Слой данных

Компоненты не должны импортировать Supabase-клиент напрямую. Они обращаются к
единому репозиторию:

```ts
import { learningRepository } from "~/data/learning";

const dashboard = await learningRepository.getDashboard();
const subjects = await learningRepository.getSubjects();
const medical = await learningRepository.getSubjectBySlug("medical-training");
const module = await learningRepository.getModule("medical-m4");
const quiz = await learningRepository.getQuiz("medical-m4-quiz");
const freeAnswer = await learningRepository.getFreeAnswer(
  "medical-m4-free-answer",
);
```

Без настроек в `.env.local` эти методы читают локальные данные из
`mock-learning.repository.ts`. После добавления URL и publishable key они через
тот же интерфейс начинают читать Supabase. Поэтому компоненты при подключении
бэкенда переписывать не придется.

Для страницы React Router лучше загружать данные в `clientLoader`, а не выполнять
запрос на верхнем уровне файла компонента:

```tsx
import { learningRepository } from "~/data/learning";
import type { Route } from "./+types/subjects";

export async function clientLoader() {
  return { subjects: await learningRepository.getSubjects() };
}

export default function SubjectsPage({ loaderData }: Route.ComponentProps) {
  return loaderData.subjects.map((subject) => (
    <article key={subject.id}>{subject.title}</article>
  ));
}
```

## Что хранится

```text
subjects
└── modules
    ├── module_sections
    ├── module_content_sources
    │   └── content_sources
    └── learning_activities
        ├── activity_questions
        │   └── question_options
        ├── evaluation_criteria
        └── free_answer_rubrics (только service_role)

auth.users
├── profiles
├── user_qualification_profiles
├── user_practice_results
│   └── physical_training_advice
├── qualification_exam_attempts
│   ├── qualification_exam_subject_results
│   └── qualification_exam_answers
├── user_activity_progress
├── activity_attempts
│   ├── quiz_answers
│   └── free_answer_submissions
│       └── criterion_scores
└── daily_plan_items
```

`learning_activities.type` определяет один из трех видов контента:
`theory`, `quiz` или `free_answer`. TypeScript превращает их в discriminated
union, поэтому после проверки `activity.type` редактор знает все доступные поля.

Правильные варианты теста лежат отдельно в `question_answer_keys`. Эта таблица
недоступна `anon` и `authenticated` ролям. Браузер видит вопросы и варианты, но
не ключи. Итоговый балл, проверку ответа и AI feedback позднее должен записывать
доверенный сервер или Supabase Edge Function, а не клиентское приложение.

## Учебный контент

В mock и seed добавлены:

- 7 предметов и 42 модуля;
- показатели дашборда, блок продолжения и план на сегодня;
- 25 наполненных модулей по медицине, РХБ-защите, топографии и уставам;
- 50 теоретических разделов, 75 предметных вопросов и 7 свободных ответов;
- закрытые опорные пункты и критерии AI-проверки;
- статусы и проценты прогресса, необходимые карточкам каталога.

Подробная карта источников и ограничения описаны в
`docs/curriculum.md`.

Экран «Прогресс» в переданном Figma-фрейме пока пустой, поэтому отдельные поля,
которых нет в остальных экранах, для него не придумывались.

## Где менять пробные данные

- `app/data/curriculum-content.ts` — единый редактируемый источник теории,
  вопросов, свободных ответов и метаданных источников для четырех наполненных
  предметов.
- `app/data/repositories/mock-learning.repository.ts` — сборка локального
  состояния пользователя поверх единого учебного источника.
- `app/data/types.ts` — контракт данных для компонентов.
- `app/data/repositories/learning.repository.ts` — список доступных операций.
- `app/data/repositories/supabase-learning.repository.ts` — преобразование строк
  PostgreSQL в тот же контракт.
- `supabase/migrations` — структура и правила доступа PostgreSQL.
- `supabase/seed.sql` — сгенерированное начальное содержимое базы; вручную не
  редактируется.
- `scripts/generate-seed.mjs` — генератор seed из TypeScript-источника.

После изменения учебного материала выполни `npm run content:seed`. Если
появляется новое поле, добавь его в типы, SQL-схему, generated-типы базы и
Supabase-репозиторий.

## Подключение Supabase

1. Создай проект в Supabase.
2. Примени migration-файлы из `supabase/migrations` по порядку, затем выполни
   `supabase/seed.sql`. С Supabase CLI это делается через `supabase db push` и
   `supabase db reset` для локальной базы.
3. Скопируй `.env.example` в `.env.local`, укажи Project URL и publishable key.
4. Перезапусти `npm run dev`.

После появления авторизации передавай `user.id` в методы, которым нужен личный
прогресс:

```ts
const dashboard = await learningRepository.getDashboard(user.id);
const results = await learningRepository.getResults(user.id);

await learningRepository.saveFreeAnswerDraft(activityId, answer, user.id);
```

Персональный маршрут использует тот же репозиторий:

```ts
const profile = await learningRepository.getQualificationProfile(user.id);
const roadmap = await learningRepository.getQualificationRoadmap(user.id);
const exam = await learningRepository.createQualificationExam(subjectIds, user.id);
const practice = await learningRepository.getPracticeResults(user.id);
const advice = await learningRepository.getPhysicalTrainingAdvice(user.id);
```

`QualificationRoadmap` — вычисляемое представление. В отдельной таблице оно не
хранится: репозиторий собирает его из профиля, учебного прогресса, последнего
пробного испытания и самостоятельно внесённых результатов. Поэтому изменение
источника данных не требует переписывать компоненты.

`service_role` key никогда не помещается во фронтенд или в переменную с
префиксом `VITE_`. Пользовательский доступ ограничивается Row Level Security.

Служебный профиль намеренно обобщён. В базе MVP не должно быть номера части,
точной должности, ВУС, места службы и материалов ограниченного распространения.
Создание маршрута требует подтверждения статуса действующего военнослужащего;
дата подтверждения хранится в `active_service_confirmed_at`.
