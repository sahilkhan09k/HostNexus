import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarX,
  CalendarPlus,
  Handshake,
  PackageCheck,
  Scale,
  ShieldCheck,
  ShieldX,
  Star,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "rose" | "sky" | "stone";

const BY_TYPE: Record<string, { icon: LucideIcon; tone: Tone }> = {
  BOOKING_REQUESTED: { icon: CalendarPlus, tone: "sky" },
  BOOKING_ACCEPTED: { icon: CalendarCheck, tone: "emerald" },
  BOOKING_REJECTED: { icon: CalendarX, tone: "rose" },
  BOOKING_CANCELLED: { icon: CalendarX, tone: "rose" },
  BOOKING_EXPIRED: { icon: CalendarX, tone: "stone" },
  OWNER_NO_SHOW: { icon: CalendarX, tone: "rose" },
  PAYMENT_REFUNDED: { icon: Wallet, tone: "sky" },
  HANDOVER_ISSUE_CONTESTED: { icon: Scale, tone: "amber" },
  PAYMENT_RECEIVED: { icon: Wallet, tone: "emerald" },
  PAYMENT_CONFIRMED: { icon: Wallet, tone: "emerald" },
  RENT_RELEASED: { icon: Wallet, tone: "emerald" },
  DEPOSIT_REFUNDED: { icon: Wallet, tone: "emerald" },
  HANDOVER_STARTED: { icon: Truck, tone: "amber" },
  RETURN_INITIATED: { icon: Truck, tone: "amber" },
  RETURN_RECEIVED: { icon: PackageCheck, tone: "emerald" },
  BOOKING_COMPLETED: { icon: PackageCheck, tone: "emerald" },
  INSPECTION_AUTO_ACCEPTED: { icon: PackageCheck, tone: "stone" },
  HANDOVER_ISSUE_REPORTED: { icon: AlertTriangle, tone: "rose" },
  RETURN_NOT_RECEIVED: { icon: AlertTriangle, tone: "rose" },
  NON_RETURN_REPORTED: { icon: AlertTriangle, tone: "rose" },
  DAMAGE_CLAIM_FILED: { icon: AlertTriangle, tone: "amber" },
  DAMAGE_CLAIM_ACCEPTED: { icon: Scale, tone: "emerald" },
  DAMAGE_CLAIM_DISPUTED: { icon: Scale, tone: "amber" },
  DISPUTE_RESOLVED: { icon: Scale, tone: "sky" },
  NEGOTIATION_OFFER: { icon: Handshake, tone: "sky" },
  NEGOTIATION_ACCEPTED: { icon: Handshake, tone: "emerald" },
  NEGOTIATION_REJECTED: { icon: Handshake, tone: "stone" },
  REVIEW_RECEIVED: { icon: Star, tone: "amber" },
  KYC_SUBMITTED: { icon: ShieldCheck, tone: "stone" },
  KYC_APPROVED: { icon: ShieldCheck, tone: "emerald" },
  KYC_REJECTED: { icon: ShieldX, tone: "rose" },
};

const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  stone: "bg-stone-100 text-stone-600",
};

export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const { icon: Icon, tone } = BY_TYPE[type] ?? { icon: Bell, tone: "stone" as Tone };
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONES[tone], className)} aria-hidden="true">
      <Icon className="h-4 w-4" />
    </span>
  );
}
