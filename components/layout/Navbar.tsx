"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faUser,
  faHouse,
  faCrown,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Inicio", icon: faHouse },
    { href: "/search", label: "Buscar", icon: faMagnifyingGlass },
  ];

  if (profile) {
    navLinks.push({
      href: `/profile/${profile.username}`,
      label: "Perfil",
      icon: faUser,
    });
  }

  return (
    <nav className="nav">
      <div className="page-container w-full flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3"
          style={{ textDecoration: "none" }}
        >
          <div className="relative h-10 w-36 flex-shrink-0">
            <Image
              src="/assets/logo2.png"
              alt="DING logo"
              fill
              sizes="144px"
              className="object-contain"
              priority
            />
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium flex items-center gap-2 transition-colors ${
                  isActive
                    ? "text-teal border-b-2 border-teal pb-1"
                    : "text-muted hover:text-teal"
                }`}
                style={{ textDecoration: "none" }}
              >
                <FontAwesomeIcon
                  icon={link.icon}
                  className="text-xs text-accent-2"
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={profile ? `/profile/${profile.username}` : "/dashboard"}
            className="w-9 h-9 border border-gray overflow-hidden relative block hover:border-teal transition-colors"
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name || "Perfil"}
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              <Image
                src="/assets/icon-blue.png"
                alt="Perfil"
                fill
                sizes="36px"
                className="object-cover"
              />
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
