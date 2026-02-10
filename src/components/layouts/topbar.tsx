"use client";

import { Bell, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import type { SessionUser } from "@/lib/types";

interface TopbarProps {
  user: SessionUser;
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      {/* Left side - page context */}
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {user.tenantSlug ? (
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {user.tenantSlug}
            </span>
          ) : (
            <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
              Super Admin
            </span>
          )}
        </h2>
      </div>

      {/* Right side - actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.role.replace("_", " ")}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
