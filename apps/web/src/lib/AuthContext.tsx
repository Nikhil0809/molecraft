"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  organization: string;
  avatar_url: string | null;
  tier: string;
  compute_credits: number;
  professional_role: string | null;
  usage_intent: string | null;
  referral_source: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    role: string,
    organization: string,
    professionalRole?: string,
    usageIntent?: string,
    referralSource?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchCurrentUser();
    })();
  }, []);

  // Redirect handling
  useEffect(() => {
    if (!loading) {
      const isPublicPage = pathname === "/login" || pathname === "/signup" || pathname === "/";
      if (!user && !isPublicPage) {
        router.push("/login");
      } else if (user && isPublicPage && pathname !== "/") {
        router.push("/generate");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Login failed");
      }

      const data = await res.json();
      setUser(data.user);
      router.push("/generate");
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    displayName: string,
    role: string,
    organization: string,
    professionalRole?: string,
    usageIntent?: string,
    referralSource?: string
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, role, organization, professionalRole, usageIntent, referralSource }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Signup failed");
      }

      const data = await res.json();
      setUser(data.user);
      router.push("/generate");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
    } catch (err) {
      console.error("Failed to logout:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
