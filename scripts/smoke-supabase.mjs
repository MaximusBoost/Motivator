import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], unquote(match[2])]),
  );
}

function readLocalSupabaseEnvironment() {
  const cliEntry = path.resolve("node_modules", "supabase", "dist", "supabase.js");
  const output = execFileSync(process.execPath, [cliEntry, "status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseEnvironment(output);
}

function resolveConnection() {
  let localEnvironment = {};
  try {
    localEnvironment = readLocalSupabaseEnvironment();
  } catch {
    // Explicit SUPABASE_TEST_* variables also allow this smoke test to run in CI.
  }

  const environment = { ...localEnvironment, ...process.env };
  const url =
    environment.SUPABASE_TEST_URL ??
    environment.SUPABASE_URL ??
    environment.API_URL;
  const publishableKey =
    environment.SUPABASE_TEST_PUBLISHABLE_KEY ??
    environment.SUPABASE_PUBLISHABLE_KEY ??
    environment.PUBLISHABLE_KEY ??
    environment.ANON_KEY;
  const secretKey =
    environment.SUPABASE_TEST_SECRET_KEY ??
    environment.SUPABASE_SECRET_KEY ??
    environment.SECRET_KEY ??
    environment.SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      "Supabase test environment is unavailable. Start it with `npm run supabase:start` " +
        "or provide SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY and " +
        "SUPABASE_TEST_SECRET_KEY.",
    );
  }

  return { url, publishableKey, secretKey };
}

function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
}

function assertNoError(error, operation) {
  assert.equal(error, null, `${operation}: ${error?.message ?? "unknown error"}`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getCorrectAnswers(admin, activityId) {
  const questionsQuery = await admin
    .from("activity_questions")
    .select("id")
    .eq("activity_id", activityId)
    .order("position");
  assertNoError(questionsQuery.error, "read quiz questions");
  assert.ok(questionsQuery.data?.length, "A seeded quiz must contain questions");

  const questionIds = questionsQuery.data.map((question) => question.id);
  const keysQuery = await admin
    .from("question_answer_keys")
    .select("question_id,correct_option_id")
    .in("question_id", questionIds);
  assertNoError(keysQuery.error, "read answer keys as service role");
  assert.equal(keysQuery.data?.length, questionIds.length, "Every question must have an answer key");

  return Object.fromEntries(
    keysQuery.data.map((answer) => [answer.question_id, answer.correct_option_id]),
  );
}

async function getQualificationAnswers(admin, subjects) {
  const subjectIds = [];
  const answers = {};

  for (const subject of subjects) {
    const modulesQuery = await admin
      .from("modules")
      .select("id")
      .eq("subject_id", subject.id)
      .eq("is_published", true);
    assertNoError(modulesQuery.error, `read modules for ${subject.slug}`);

    const moduleIds = modulesQuery.data.map((module) => module.id);
    assert.ok(moduleIds.length, `${subject.slug} must contain published modules`);

    const activitiesQuery = await admin
      .from("learning_activities")
      .select("id")
      .in("module_id", moduleIds)
      .eq("type", "quiz")
      .eq("is_published", true);
    assertNoError(activitiesQuery.error, `read quizzes for ${subject.slug}`);

    const activityIds = activitiesQuery.data.map((activity) => activity.id);
    assert.ok(activityIds.length, `${subject.slug} must contain published quizzes`);

    const questionsQuery = await admin
      .from("activity_questions")
      .select("id")
      .in("activity_id", activityIds)
      .order("id")
      .limit(10);
    assertNoError(questionsQuery.error, `read qualification questions for ${subject.slug}`);
    assert.equal(questionsQuery.data.length, 10, `${subject.slug} must provide 10 exam questions`);

    const questionIds = questionsQuery.data.map((question) => question.id);
    const keysQuery = await admin
      .from("question_answer_keys")
      .select("question_id,correct_option_id")
      .in("question_id", questionIds);
    assertNoError(keysQuery.error, `read qualification keys for ${subject.slug}`);
    assert.equal(keysQuery.data.length, 10, `${subject.slug} must provide 10 answer keys`);

    subjectIds.push(subject.id);
    for (const answer of keysQuery.data) {
      answers[answer.question_id] = answer.correct_option_id;
    }
  }

  return { subjectIds, answers };
}

async function main() {
  const { url, publishableKey, secretKey } = resolveConnection();
  const admin = createClient(url, secretKey, clientOptions());
  const learner = createClient(url, publishableKey, clientOptions());
  const outsider = createClient(url, publishableKey, clientOptions());

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const password = `Smoke-${suffix}-A9!`;
  const learnerEmail = `smoke-learner-${suffix}@example.test`;
  const outsiderEmail = `smoke-outsider-${suffix}@example.test`;
  const learnerUsername = `learner_${suffix}`.slice(0, 24);
  const outsiderUsername = `outsider_${suffix}`.slice(0, 24);
  const createdUserIds = [];

  try {
    for (const account of [
      { email: learnerEmail, username: learnerUsername },
      { email: outsiderEmail, username: outsiderUsername },
    ]) {
      const creation = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: account.username,
          username: account.username,
        },
      });
      assertNoError(creation.error, `create ${account.username}`);
      assert.ok(creation.data.user, `Auth must return ${account.username}`);
      createdUserIds.push(creation.data.user.id);
    }

    const [learnerId, outsiderId] = createdUserIds;
    const learnerLogin = await learner.auth.signInWithPassword({ email: learnerEmail, password });
    assertNoError(learnerLogin.error, "learner sign in");
    const outsiderLogin = await outsider.auth.signInWithPassword({ email: outsiderEmail, password });
    assertNoError(outsiderLogin.error, "outsider sign in");

    const ownProfile = await learner.from("profiles").select("id,username").single();
    assertNoError(ownProfile.error, "read own profile");
    assert.equal(ownProfile.data.username, learnerUsername, "Auth trigger must persist username");

    const foreignProfile = await outsider
      .from("profiles")
      .select("id")
      .eq("id", learnerId)
      .maybeSingle();
    assertNoError(foreignProfile.error, "RLS profile query");
    assert.equal(foreignProfile.data, null, "RLS must hide another user's profile");

    const subjectsQuery = await learner
      .from("subjects")
      .select("id,slug,title")
      .eq("is_published", true)
      .order("position");
    assertNoError(subjectsQuery.error, "read published subjects");
    assert.equal(subjectsQuery.data.length, 7, "Seed must expose exactly seven subjects");

    const qualificationProfile = await learner.from("user_qualification_profiles").insert({
      user_id: learnerId,
      is_active_service_member: true,
      service_type: "contract",
      personnel_category: "soldier",
      position_profile: "primary",
      has_subordinates: false,
      service_direction: "general",
      service_started_at: "2024-01-01",
      current_qualification: "none",
      target_qualification: "third",
      policy_version: "mvp-smoke-v1",
    });
    assertNoError(qualificationProfile.error, "create qualification profile");

    const foreignQualification = await outsider
      .from("user_qualification_profiles")
      .select("user_id")
      .eq("user_id", learnerId)
      .maybeSingle();
    assertNoError(foreignQualification.error, "RLS qualification query");
    assert.equal(foreignQualification.data, null, "RLS must hide qualification profile");

    const practiceQuery = await learner
      .from("user_practice_results")
      .insert({
        user_id: learnerId,
        category: "physical",
        title: "Local integration test",
        value: 15,
        unit: "repetitions",
        grade: 5,
        performed_at: today(),
        notes: "Temporary smoke-test record",
      })
      .select("id")
      .single();
    assertNoError(practiceQuery.error, "save physical result");

    const foreignPractice = await outsider
      .from("user_practice_results")
      .select("id")
      .eq("id", practiceQuery.data.id)
      .maybeSingle();
    assertNoError(foreignPractice.error, "RLS practice query");
    assert.equal(foreignPractice.data, null, "RLS must hide another user's practice result");

    const hiddenKeys = await learner.from("question_answer_keys").select("question_id").limit(1);
    assert.ok(
      hiddenKeys.error || hiddenKeys.data?.length === 0,
      "Browser role must not receive quiz answer keys",
    );

    const hiddenRubrics = await learner
      .from("free_answer_rubrics")
      .select("activity_id")
      .limit(1);
    assert.ok(
      hiddenRubrics.error || hiddenRubrics.data?.length === 0,
      "Browser role must not receive free-answer reference points",
    );

    const sourceCount = await learner
      .from("content_sources")
      .select("id", { count: "exact", head: true });
    assertNoError(sourceCount.error, "read curriculum sources");
    assert.equal(sourceCount.count, 10, "Seed must expose ten curriculum sources");

    const rubricCount = await admin
      .from("free_answer_rubrics")
      .select("activity_id", { count: "exact", head: true });
    assertNoError(rubricCount.error, "read free-answer rubrics as service role");
    assert.equal(rubricCount.count, 7, "Seed must contain seven server-only rubrics");

    const freeAnswerQuery = await admin
      .from("learning_activities")
      .select("id,module_id")
      .eq("type", "free_answer")
      .eq("is_published", true)
      .limit(1)
      .single();
    assertNoError(freeAnswerQuery.error, "select free-answer activity");

    const lockedAccess = await learner.rpc("is_free_answer_unlocked", {
      p_activity_id: freeAnswerQuery.data.id,
    });
    assertNoError(lockedAccess.error, "check locked free-answer activity");
    assert.equal(lockedAccess.data, false, "Free answer must start locked");

    const blockedAttempt = await learner.from("activity_attempts").insert({
      user_id: learnerId,
      activity_id: freeAnswerQuery.data.id,
      status: "draft",
    });
    assert.ok(blockedAttempt.error, "RLS must block a premature free-answer attempt");

    const moduleQuizzes = await admin
      .from("learning_activities")
      .select("id")
      .eq("module_id", freeAnswerQuery.data.module_id)
      .eq("type", "quiz")
      .eq("is_published", true)
      .order("position");
    assertNoError(moduleQuizzes.error, "select prerequisite module quizzes");
    assert.ok(moduleQuizzes.data.length, "Free-answer module must contain a quiz");

    for (const quiz of moduleQuizzes.data) {
      const quizAnswers = await getCorrectAnswers(admin, quiz.id);
      const quizSubmission = await learner.rpc("submit_quiz", {
        p_activity_id: quiz.id,
        p_answers: quizAnswers,
      });
      assertNoError(quizSubmission.error, "submit prerequisite module quiz");
      assert.equal(quizSubmission.data?.[0]?.score, 100, "Server must grade correct quiz as 100%");
    }

    const unlockedAccess = await learner.rpc("is_free_answer_unlocked", {
      p_activity_id: freeAnswerQuery.data.id,
    });
    assertNoError(unlockedAccess.error, "check unlocked free-answer activity");
    assert.equal(unlockedAccess.data, true, "Free answer must unlock after module quizzes");

    const allowedAttempt = await learner
      .from("activity_attempts")
      .insert({
        user_id: learnerId,
        activity_id: freeAnswerQuery.data.id,
        status: "draft",
      })
      .select("id")
      .single();
    assertNoError(allowedAttempt.error, "create unlocked free-answer attempt");

    const examInput = await getQualificationAnswers(admin, subjectsQuery.data.slice(0, 4));
    const examSubmission = await learner.rpc("submit_qualification_exam", {
      p_subject_ids: examInput.subjectIds,
      p_answers: examInput.answers,
      p_started_at: new Date().toISOString(),
    });
    assertNoError(examSubmission.error, "submit qualification exam");
    const attemptId = examSubmission.data?.[0]?.attempt_id;
    assert.ok(attemptId, "Qualification RPC must return an attempt id");

    const ownAttempt = await learner
      .from("qualification_exam_attempts")
      .select("average_score_percent,predicted_qualification,qualifies_for_target")
      .eq("id", attemptId)
      .single();
    assertNoError(ownAttempt.error, "read own qualification result");
    assert.equal(ownAttempt.data.average_score_percent, 100, "Exam average must be 100%");
    assert.equal(ownAttempt.data.qualifies_for_target, true, "Perfect exam must reach third class");

    const subjectResults = await learner
      .from("qualification_exam_subject_results")
      .select("subject_id,grade")
      .eq("attempt_id", attemptId);
    assertNoError(subjectResults.error, "read qualification subject results");
    assert.equal(subjectResults.data.length, 4, "Exam must persist four subject results");
    assert.ok(subjectResults.data.every((result) => result.grade === 5));

    const foreignAttempt = await outsider
      .from("qualification_exam_attempts")
      .select("id")
      .eq("id", attemptId)
      .maybeSingle();
    assertNoError(foreignAttempt.error, "RLS qualification attempt query");
    assert.equal(foreignAttempt.data, null, "RLS must hide another user's exam result");

    assert.notEqual(learnerId, outsiderId);
    console.log("Supabase smoke passed: Auth, seed, RLS, gated free answer and qualification RPC.");
  } finally {
    await learner.auth.signOut();
    await outsider.auth.signOut();
    for (const userId of createdUserIds.reverse()) {
      const deletion = await admin.auth.admin.deleteUser(userId);
      if (deletion.error) {
        console.warn(`Could not delete smoke user ${userId}: ${deletion.error.message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
