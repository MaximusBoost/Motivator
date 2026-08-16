import { hasSupabaseConfig } from "~/lib/supabase/client";
import { mockLearningRepository } from "./repositories/mock-learning.repository";
import { supabaseLearningRepository } from "./repositories/supabase-learning.repository";

// Без .env.local приложение использует локальные данные и не блокирует верстку.
// После добавления ключей тот же интерфейс автоматически начинает читать Supabase.
export const learningRepository = hasSupabaseConfig
  ? supabaseLearningRepository
  : mockLearningRepository;
