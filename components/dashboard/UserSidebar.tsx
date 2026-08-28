"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  ShieldAlert,
  FolderOpen,
  Users,
  AlertTriangle,
  ClipboardCheck,
  UserCircle,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonalRolEnum } from "@/lib/types";

type EffectiveRol = PersonalRolEnum | "admin";

const navItems: { label: string; href: string; icon: typeof Home; roles: EffectiveRol[] }[] = [
  { label: "Inicio", href: "/dashboard", icon: Home, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Documentos", href: "/dashboard/documentos", icon: FolderOpen, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Mi RAT", href: "/dashboard/rat", icon: FileText, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Riesgos", href: "/dashboard/riesgos", icon: ShieldAlert, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Plan de impl.", href: "/dashboard/plan", icon: AlertTriangle, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Plan DPD", href: "/dashboard/dpd", icon: ClipboardCheck, roles: ["admin", "contador"] },
  { label: "Personal", href: "/dashboard/personal", icon: Users, roles: ["admin", "contador"] },
  { label: "Herramientas", href: "/dashboard/herramientas", icon: Wrench, roles: ["admin", "contador", "asistente", "cliente"] },
  { label: "Mi Perfil", href: "/dashboard/perfil", icon: UserCircle, roles: ["admin", "contador", "asistente"] },
];

export default function UserSidebar({ effectiveRol }: { effectiveRol: EffectiveRol }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(effectiveRol));

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-56 bg-white border-r border-bac-gray-border overflow-y-auto z-20 flex flex-col">
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors",
                active
                  ? "bg-bac-red text-white"
                  : "text-bac-gray-text hover:bg-bac-gray-alt"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    active ? "bg-white" : "bg-bac-gray-text"
                  )}
                />
                <Icon className="w-4 h-4" />
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-bac-gray-border p-3">
        <Link
          href="/dashboard/mensajes"
          className={cn(
            "flex items-center gap-3 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors",
            pathname.startsWith("/dashboard/mensajes")
              ? "bg-bac-red text-white"
              : "text-bac-gray-text hover:bg-bac-gray-alt"
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                pathname.startsWith("/dashboard/mensajes")
                  ? "bg-white"
                  : "bg-bac-gray-text"
              )}
            />
            <MessageSquare className="w-4 h-4" />
          </div>
          Mensajes
        </Link>
      </div>
    </aside>
  );
}
