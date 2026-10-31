"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";

export interface AdminUserDropdownProps {
  user: {
    email: string;
    role: "admin" | "viewer";
  };
}

export function AdminUserDropdown({ user }: AdminUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="เมนูผู้ใช้งาน"
        className={`group flex items-center gap-2.5 rounded-xl border p-1.5 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer ${
          isOpen
            ? "border-slate-300 bg-slate-100/90 shadow-xs"
            : "border-transparent hover:border-slate-200 hover:bg-slate-50"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#101b36] text-xs font-bold uppercase text-white shadow-xs transition group-hover:scale-105"
        >
          {user.email[0]}
        </span>
        <span className="hidden min-w-0 text-[13px] sm:block">
          <span className="block max-w-[13rem] truncate font-semibold text-slate-900 group-hover:text-emerald-950">
            {user.email}
          </span>
          <span className="block text-xs text-slate-600">
            {user.role === "admin" ? "Administrator" : "Viewer (read-only)"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${
            isOpen ? "rotate-180 text-emerald-700" : ""
          }`}
        />
      </button>

      {/* Compact Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-2 w-48 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Mobile view only: show account email header since button text is hidden on small screens */}
          <div className="px-2.5 py-1.5 sm:hidden border-b border-slate-100 mb-1">
            <p className="truncate text-xs font-semibold text-slate-900">{user.email}</p>
            <p className="text-[10px] text-slate-500">{user.role === "admin" ? "Administrator" : "Viewer"}</p>
          </div>

          {/* Profile link */}
          <Link
            href="/admin/profile"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 transition"
          >
            <User className="h-4 w-4 text-slate-400 group-hover:text-emerald-700" />
            <span>Profile</span>
          </Link>

          {/* Setting link */}
          <Link
            href="/admin/settings/admins"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 transition"
          >
            <Settings className="h-4 w-4 text-slate-400 group-hover:text-emerald-700" />
            <span>Settings</span>
          </Link>

          <div className="my-1 border-t border-slate-100" />

          {/* Logout button */}
          <form action="/api/admin/auth/logout" method="POST" className="w-full">
            <button
              type="submit"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-rose-400 group-hover:text-rose-600" />
              <span>Logout</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
