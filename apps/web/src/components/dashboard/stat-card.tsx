import { motion, type Easing } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconBg: string;
  index?: number;
}

export function StatCard({ label, value, change, changeType, icon: Icon, iconBg, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: EASE }}
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{label}</p>
          <p className="mt-2 font-mono text-3xl font-extrabold tracking-tight text-stone-900">{value}</p>
          {change && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  "text-xs font-semibold",
                  changeType === "positive" && "text-emerald-600",
                  changeType === "negative" && "text-rose-600",
                  changeType === "neutral" && "text-stone-400"
                )}
              >
                {change}
              </span>
              <span className="text-xs text-stone-400">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
}
