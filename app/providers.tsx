"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface User {
  name: string;
}

interface UserContextValue {
  user: User | null;
  login: (u: User | null) => void;
  signOut: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates from localStorage after mount to avoid SSR mismatch
      setUser(JSON.parse(localStorage.getItem("av_user") || "null"));
    } catch {
      setUser(null);
    }
  }, []);

  const login = (u: User | null) => {
    setUser(u);
    if (u) localStorage.setItem("av_user", JSON.stringify(u));
    else localStorage.removeItem("av_user");
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("av_user");
  };

  return (
    <UserContext.Provider value={{ user, login, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
