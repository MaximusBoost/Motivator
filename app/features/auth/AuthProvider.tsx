import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient, hasSupabaseConfig } from "~/lib/supabase/client";

const DEMO_USERS_KEY = "motivator:demo-users";
const DEMO_SESSION_KEY = "motivator:demo-session";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

type DemoUser = AuthUser & {
  passwordHash: string;
};

type SignUpInput = {
  email: string;
  password: string;
  username: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isDemoMode: boolean;
  signUp: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  continueAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeUsername(username: string) {
  return username.trim();
}

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Неверный email или пароль.";
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Пользователь с таким email уже зарегистрирован.";
  }
  if (normalized.includes("duplicate") || normalized.includes("unique")) {
    return "Этот никнейм уже занят.";
  }
  if (normalized.includes("database error saving new user")) {
    return "Не удалось создать профиль. Проверьте никнейм: возможно, он уже занят.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Сначала подтвердите email по ссылке из письма.";
  }
  if (normalized.includes("password")) {
    return "Пароль не соответствует требованиям безопасности.";
  }

  return message;
}

async function loadSupabaseUser(user: User): Promise<AuthUser> {
  const client = getSupabaseClient();
  const profileResult = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackUsername =
    String(user.user_metadata.username ?? user.user_metadata.display_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "Курсант";

  return {
    id: user.id,
    email: user.email ?? "",
    username: profileResult.data?.username ?? profileResult.data?.display_name ?? fallbackUsername,
  };
}

export async function getCurrentUserId(): Promise<string | undefined> {
  if (hasSupabaseConfig) {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.user.id;
  }

  return readJson<AuthUser | null>(DEMO_SESSION_KEY, null)?.id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!hasSupabaseConfig) {
      setUser(readJson<AuthUser | null>(DEMO_SESSION_KEY, null));
      setIsLoading(false);
      return;
    }

    const client = getSupabaseClient();

    void client.auth.getSession().then(async ({ data }) => {
      const nextUser = data.session?.user ? await loadSupabaseUser(data.session.user) : null;
      if (active) {
        setUser(nextUser);
        setIsLoading(false);
      }
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        const nextUser = session?.user ? await loadSupabaseUser(session.user) : null;
        if (active) {
          setUser(nextUser);
          setIsLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async ({ email, password, username }: SignUpInput) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = normalizeUsername(username);

    if (hasSupabaseConfig) {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
            display_name: normalizedUsername,
          },
        },
      });

      if (error) throw new Error(friendlyAuthError(error.message));

      if (data.session?.user) {
        setUser(await loadSupabaseUser(data.session.user));
      }

      return { requiresEmailConfirmation: !data.session };
    }

    const demoUsers = readJson<DemoUser[]>(DEMO_USERS_KEY, []);
    if (demoUsers.some((item) => item.email.toLowerCase() === normalizedEmail)) {
      throw new Error("Пользователь с таким email уже зарегистрирован.");
    }
    if (demoUsers.some((item) => item.username.toLowerCase() === normalizedUsername.toLowerCase())) {
      throw new Error("Этот никнейм уже занят.");
    }

    const authUser: AuthUser = {
      id: window.crypto.randomUUID(),
      email: normalizedEmail,
      username: normalizedUsername,
    };
    const demoUser: DemoUser = {
      ...authUser,
      passwordHash: await hashPassword(password),
    };

    writeJson(DEMO_USERS_KEY, [...demoUsers, demoUser]);
    writeJson(DEMO_SESSION_KEY, authUser);
    setUser(authUser);
    return { requiresEmailConfirmation: false };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (hasSupabaseConfig) {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw new Error(friendlyAuthError(error.message));
      setUser(await loadSupabaseUser(data.user));
      return;
    }

    const passwordHash = await hashPassword(password);
    const demoUser = readJson<DemoUser[]>(DEMO_USERS_KEY, []).find(
      (item) => item.email.toLowerCase() === normalizedEmail && item.passwordHash === passwordHash,
    );
    if (!demoUser) throw new Error("Неверный email или пароль.");

    const authUser: AuthUser = {
      id: demoUser.id,
      email: demoUser.email,
      username: demoUser.username,
    };
    writeJson(DEMO_SESSION_KEY, authUser);
    setUser(authUser);
  }, []);

  const continueAsDemo = useCallback(async () => {
    const authUser: AuthUser = {
      id: "demo-user",
      email: "demo@motivator.local",
      username: "Курсант",
    };
    writeJson(DEMO_SESSION_KEY, authUser);
    setUser(authUser);
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabaseConfig) {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw new Error(friendlyAuthError(error.message));
    } else {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isDemoMode: !hasSupabaseConfig,
    signUp,
    signIn,
    continueAsDemo,
    signOut,
  }), [continueAsDemo, isLoading, signIn, signOut, signUp, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth должен использоваться внутри AuthProvider.");
  return value;
}
