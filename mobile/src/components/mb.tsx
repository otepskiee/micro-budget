import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts } from "@/lib/theme";
import { format } from "@/lib/money";

// "The Ledger-Tape" primitives, ported to React Native + NativeWind. Colours are
// tokens that flip between the light/dark receipt themes automatically.

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-paper">
      {children}
    </SafeAreaView>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text
      style={{ fontFamily: fonts.mono }}
      className={`text-carbon text-[11px] uppercase tracking-[0.14em] ${className ?? ""}`}
    >
      {children}
    </Text>
  );
}

export function Ritual({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`text-ink font-extrabold uppercase tracking-[0.02em] ${className ?? ""}`}>
      {children}
    </Text>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text style={{ fontFamily: fonts.mono }} className={`text-ink ${className ?? ""}`}>
      {children}
    </Text>
  );
}

export function Money({
  minor,
  currency,
  className,
}: {
  minor: number;
  currency: string;
  className?: string;
}) {
  return (
    <Text style={{ fontFamily: fonts.mono }} className={`text-ink ${className ?? ""}`}>
      {format(minor, currency)}
    </Text>
  );
}

export function Rule({ className }: { className?: string }) {
  return <View className={`h-[2px] bg-ink ${className ?? ""}`} />;
}

export function DottedRule({ className }: { className?: string }) {
  return <View className={`border-t border-dashed border-hair ${className ?? ""}`} />;
}

type Tone = "teal" | "amber" | "red" | "ink";
export function Stamp({ tone = "ink", children }: { tone?: Tone; children: ReactNode }) {
  const c =
    tone === "teal"
      ? "text-teal border-teal"
      : tone === "amber"
        ? "text-amber-ink border-amber-ink"
        : tone === "red"
          ? "text-red border-red"
          : "text-carbon border-carbon";
  return (
    <Text
      style={{ fontFamily: fonts.mono }}
      className={`text-[10px] uppercase tracking-[0.12em] border rounded-[3px] px-1.5 py-0.5 ${c}`}
    >
      {children}
    </Text>
  );
}

export function Bar({ pct, state }: { pct: number; state: "ok" | "warn" | "over" }) {
  const fill = state === "over" ? "bg-red" : state === "warn" ? "bg-amber" : "bg-ink";
  return (
    <View className="h-[7px] border border-ink bg-paper-lit">
      <View className={`h-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </View>
  );
}
