"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, User } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";
import { UserAvatar } from "@/components/UserAvatar";
import { clearInviteCode } from "@/lib/inviteStorage";
import { trackEvent } from "@/lib/analytics";

export function PersonalInfoPage() {
  const router = useRouter();
  const { user, setCurrentPage } = useApp();

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <button 
          className="back-button" 
          onClick={() => {
            setCurrentPage("main");
            router.replace("/");
          }} 
          type="button"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Personal Information</h1>
      </div>

      <div className="personal-info-card">
        <div className="personal-info-avatar">
          <UserAvatar
            className="personal-avatar"
            email={user.email}
            name={user.displayName}
            photoURL={user.photoURL}
          />
        </div>

        <div className="personal-info-details">
          <div className="info-row">
            <span className="info-label">
              <User size={16} />
              Name
            </span>
            <span className="info-value">{user.displayName ?? "Not set"}</span>
          </div>

          <div className="info-row">
            <span className="info-label">
              <Mail size={16} />
              Email
            </span>
            <span className="info-value">{user.email}</span>
          </div>
        </div>

        <p className="personal-info-note">
          Your profile information is managed through your Google account.
        </p>

        <button
          className="danger-button full-width"
          onClick={() => {
            trackEvent("logout_clicked", { page: "personal_information" });
            clearInviteCode();
            signOut(auth);
          }}
          type="button"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
