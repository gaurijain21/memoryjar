"use client";

import { ArrowLeft, Mail, User } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";

export function PersonalInfoPage() {
  const { user, setCurrentPage } = useApp();

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <button 
          className="back-button" 
          onClick={() => setCurrentPage("main")} 
          type="button"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Personal Information</h1>
      </div>

      <div className="personal-info-card">
        <div className="personal-info-avatar">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" />
          ) : (
            <div className="avatar-placeholder">
              <User size={40} />
            </div>
          )}
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
          onClick={() => signOut(auth)}
          type="button"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
