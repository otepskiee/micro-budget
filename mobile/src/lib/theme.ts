import { useColorScheme } from "nativewind";

// Fragment Mono carries every figure (loaded in the root layout via expo-font).
// Display/body faces (Bricolage / Hanken) are a follow-up.
export const fonts = {
  mono: "FragmentMono",
};

// Hex mirrors of the global.css tokens, for imperative needs (icons, StatusBar).
export const LIGHT = {
  paper: "#E3E5DE", paperLit: "#EDEEE8", ink: "#211C15", carbon: "#5E5A4F",
  teal: "#0F6B62", tealDeep: "#0B4F48", amber: "#E79A2E", amberInk: "#85500F",
  red: "#B23520", manila: "#D6CBB4", faded: "#6E6A5B", slipMuted: "#48443B",
  onAmber: "#211C15", hair: "rgba(33,28,21,0.22)",
};
export const DARK = {
  paper: "#141109", paperLit: "#211C15", ink: "#ECE6D8", carbon: "#A49C8A",
  teal: "#4CBBA9", tealDeep: "#6FD0BF", amber: "#E7A23E", amberInk: "#E8AC55",
  red: "#E8735C", manila: "#2E2619", faded: "#8C8574", slipMuted: "#B0A791",
  onAmber: "#211C15", hair: "rgba(236,230,216,0.2)",
};

export type Palette = typeof LIGHT;

export function usePalette(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? DARK : LIGHT;
}
