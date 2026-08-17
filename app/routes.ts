import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home/home.tsx"),
  route("login", "routes/login/login.tsx"),
  route("register", "routes/register/register.tsx"),
  route("onboarding", "routes/onboarding/onboarding.tsx"),
  route("qualification", "routes/qualification/qualification.tsx"),
  route("qualification/exam", "routes/qualification-exam/qualification-exam.tsx"),
  route(
    "qualification/exam/results/:attemptId",
    "routes/qualification-exam-result/qualification-exam-result.tsx",
  ),
  route("practice", "routes/practice/practice.tsx"),
  route("subjects", "routes/subjects/subjects.tsx"),
  route("subjects/:subjectSlug", "routes/subject-detail/subject-detail.tsx"),
  route("modules/:moduleId", "routes/module/module.tsx"),
  route("activities/:activityId", "routes/activity/activity.tsx"),
  route("results", "routes/results/results.tsx"),
  route("results/:attemptId", "routes/result-detail/result-detail.tsx"),
  route("progress", "routes/progress/progress.tsx"),
  route("goals", "routes/goals/goals.tsx"),
  route("profile", "routes/profile/profile.tsx"),
] satisfies RouteConfig;
