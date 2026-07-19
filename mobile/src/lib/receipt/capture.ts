import * as ImagePicker from "expo-image-picker";

export type Capture = { uri: string; base64: string; mediaType: string };

/** Take or pick a receipt photo. Returns null if denied or cancelled. */
export async function captureReceipt(source: "camera" | "library"): Promise<Capture | null> {
  const perm =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const opts = { base64: true, quality: 0.6, mediaTypes: ["images"] as ImagePicker.MediaType[] };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, base64: a.base64 ?? "", mediaType: a.mimeType ?? "image/jpeg" };
}
