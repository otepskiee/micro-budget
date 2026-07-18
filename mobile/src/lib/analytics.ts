import PostHog from "posthog-react-native";

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

// Null when unconfigured so the app still runs; capture() then no-ops.
export const posthog = key ? new PostHog(key, { host }) : null;

type Props = Record<string, string | number | boolean | null>;

export function capture(event: string, properties?: Props) {
  posthog?.capture(event, properties);
}
