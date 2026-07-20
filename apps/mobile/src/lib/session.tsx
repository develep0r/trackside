import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MOCK_MODE, getMyRole, getSessionUserId, initApi, onAuthChange, type Role,
} from "./api";

// Native needs AsyncStorage for session persistence; web uses localStorage.
// (No-op in mock mode — the mock keeps its own session.)
if (!MOCK_MODE && Platform.OS !== "web") initApi({ storage: AsyncStorage });

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
    (async () => {
      const uid = await getSessionUserId();
      setUserId(uid);
      if (uid) setRole(await getMyRole());
      setLoading(false);
    })();
    return onAuthChange(async (uid) => {
      setUserId(uid);
      setRole(uid ? await getMyRole() : null);
    });
  }, []);

  return (
    <SessionContext.Provider value={{ loading, userId, role, refreshRole }}>
      {children}
    </SessionContext.Provider>
  );
}
