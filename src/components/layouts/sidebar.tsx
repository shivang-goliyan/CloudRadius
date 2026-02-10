"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Ticket,
  Router,
  MapPin,
  Wifi,
  History,
  MessageSquare,
  UserPlus,
  BarChart3,
  Settings,
  Radio,
  ChevronLeft,
  FileText,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useState } from "react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Ticket,
  Router,
  MapPin,
  Wifi,
  History,
  MessageSquare,
  UserPlus,
  BarChart3,
  Settings,
  FileText,
  CreditCard,
};

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Subscribers", href: "/subscribers", icon: "Users" },
  { title: "Plans", href: "/plans", icon: "Package" },
  { title: "Invoices", href: "/billing/invoices", icon: "FileText" },
  { title: "Payments", href: "/billing/payments", icon: "CreditCard" },
  { title: "Vouchers", href: "/vouchers", icon: "Ticket" },
  { title: "NAS Devices", href: "/nas", icon: "Router" },
  { title: "Locations", href: "/locations", icon: "MapPin" },
  { title: "Online Users", href: "/online-users", icon: "Wifi" },
  { title: "Sessions", href: "/sessions", icon: "History" },
  { title: "Complaints", href: "/complaints", icon: "MessageSquare" },
  { title: "Leads", href: "/leads", icon: "UserPlus" },
  { title: "Reports", href: "/reports", icon: "BarChart3" },
  { title: "Settings", href: "/settings", icon: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">{APP_NAME}</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <Radio className="h-6 w-6 text-primary" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            collapsed && "mx-auto"
          )}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            {APP_NAME} v0.1.0
          </p>
        </div>
      )}
    </aside>
  );
}
