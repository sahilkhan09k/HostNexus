"use client";

import { useState, useEffect } from "react";
import { User, Building, Bell, Lock, CreditCard, Save, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { AuthService } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DISPLAY_NAME_KEY = "hostnexus_display_name";

const TABS = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "business",      label: "Business",      icon: Building },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security",      label: "Security",      icon: Lock },
  { id: "billing",       label: "Billing",       icon: CreditCard },
];

type Toast = { type: "success" | "error"; message: string } | null;

// ── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const stored = localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
    setDisplayName(stored);
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(DISPLAY_NAME_KEY, displayName.trim());
      showToast("success", "Profile saved successfully.");
    } catch {
      showToast("error", "Failed to save profile.");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900">Profile Settings</h2>
      <p className="mt-1 text-sm text-stone-500">Update your personal information</p>

      {toast && (
        <div className={cn(
          "mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        )}>
          {toast.type === "success"
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-stone-400">Email cannot be changed.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Business Tab ─────────────────────────────────────────────────────────────

function BusinessTab() {
  const { business } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (business?.name) {
      setBusinessName(business.name);
    }
  }, [business]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!business?.id) {
      showToast("error", "No business found to update.");
      return;
    }
    const token = AuthService.getToken();
    if (!token) {
      showToast("error", "Not authenticated.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/business/${business.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: businessName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Update failed" }));
        showToast("error", err.message ?? "Failed to update business.");
        return;
      }

      // Refresh stored business
      await AuthService.fetchAndStoreBusiness(token);
      showToast("success", "Business name updated successfully.");
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900">Business Settings</h2>
      <p className="mt-1 text-sm text-stone-500">Manage your business profile</p>

      {toast && (
        <div className={cn(
          "mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        )}>
          {toast.type === "success"
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Business Name
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your business name"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shell Tabs ────────────────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900">Notification Preferences</h2>
      <p className="mt-1 text-sm text-stone-500">Control how and when you receive notifications</p>
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-400">
        Notification settings coming soon.
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900">Security</h2>
      <p className="mt-1 text-sm text-stone-500">Manage your password and account security</p>
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-400">
        Security settings coming soon.
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div>
      <h2 className="text-lg font-bold text-stone-900">Billing</h2>
      <p className="mt-1 text-sm text-stone-500">Manage your subscription and payment methods</p>
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-400">
        Billing settings coming soon.
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  const renderTab = () => {
    switch (activeTab) {
      case "profile":       return <ProfileTab />;
      case "business":      return <BusinessTab />;
      case "notifications": return <NotificationsTab />;
      case "security":      return <SecurityTab />;
      case "billing":       return <BillingTab />;
      default:              return <ProfileTab />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left sidebar tabs */}
        <div className="space-y-1 rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white"
                    : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
