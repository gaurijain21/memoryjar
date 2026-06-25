"use client";

import { CalendarDays, LogOut, Mail, Pencil } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";
import { UserAvatar } from "@/components/UserAvatar";
import { clearInviteCode } from "@/lib/inviteStorage";
import { trackEvent } from "@/lib/analytics";

export function PersonalInfoPage() {
  const { user } = useApp();

  if (!user) return null;

  const displayName = user.displayName ?? user.email?.split("@")[0] ?? "Memory keeper";
  const email = user.email ?? "No email connected";
  const memberSince = user.metadata.creationTime
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(user.metadata.creationTime))
    : "Not available";

  return (
    <div className="page-container personal-info-page embedded-page">
      <header className="personal-info-heading">
        <h1>Personal Information</h1>
        <p>Manage your account and view your recent memories.</p>
      </header>

      <section className="personal-info-card" aria-labelledby="personal-info-title">
        <div className="personal-info-card-header">
          <div className="personal-info-profile">
            <UserAvatar
              className="personal-avatar"
              email={user.email}
              id={user.uid}
              name={user.displayName}
              photoURL={user.photoURL}
            />
            <div>
              <h2 id="personal-info-title">{displayName}</h2>
              <span>{email}</span>
            </div>
          </div>

          <button className="edit-profile-button" type="button">
            <Pencil size={17} />
            Edit Profile
          </button>
        </div>

        <div className="personal-info-card-body">
          <div className="personal-info-details">
            <article className="info-row">
              <span className="info-icon">
                <Mail size={18} />
              </span>
              <div>
                <span className="info-label">Email</span>
                <span className="info-value">{email}</span>
              </div>
            </article>

            <article className="info-row">
              <span className="info-icon">
                <CalendarDays size={18} />
              </span>
              <div>
                <span className="info-label">Member Since</span>
                <span className="info-value">{memberSince}</span>
              </div>
            </article>
          </div>

          <div className="personal-info-action">
            <button
              className="personal-signout-button"
              onClick={() => {
                trackEvent("logout_clicked", { page: "personal_information" });
                clearInviteCode();
                void signOut(auth);
              }}
              type="button"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
