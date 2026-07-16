import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initApi, supabase, getMyRole, type Role } from "@trackside/api";

// Native needs AsyncStorage for session persistence; web uses localStorage.
if (Platform.OS !== "web") initApi({ storage: AsyncStorage });

export interface SessionState {
  loading: boolean;
  userId: string | null;
  role: Role | null;
  refreshRole: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  loading: true,
  userId: null,
  role: null,
  refreshRole: async () => {},
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const refreshRole = async () => setRole(await getMyRole());

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) setRole(await getMyRole());
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      setRole(uid ? await getMyRole() : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ loading, userId, role, refreshRole }}>
      {children}
    </SessionContext.Provider>
  );
}
