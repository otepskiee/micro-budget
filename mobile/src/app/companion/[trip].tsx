import { useCallback, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule } from "@/components/mb";
import { addPerson, addTripMember } from "@/lib/db/mutations";
import { getTripMembers } from "@/lib/db/queries";

export default function Companion() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(() => {
    if (trip) getTripMembers(trip).then(setMembers);
  }, [trip]);
  useFocusEffect(useCallback(() => load(), [load]));

  const add = async () => {
    if (!name.trim() || !trip) return;
    const pid = await addPerson(name.trim());
    await addTripMember(trip, pid);
    setName("");
    load();
  };

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-3">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">Companions</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Done</Text>
            </Pressable>
          </View>
          <Eyebrow className="mt-1">
            Ghost mode · no accounts, no invites
          </Eyebrow>
          <Rule className="mt-3" />

          {members.map((m) => (
            <View key={m.id} className="py-2 border-t border-hair">
              <Text className="text-ink font-semibold">{m.name}</Text>
            </View>
          ))}

          <Eyebrow className="mt-5 mb-1">Add someone</Eyebrow>
          <View className="flex-row gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="#8A8578"
              className="flex-1 border border-hair rounded-md px-3 py-3 text-ink"
            />
            <Pressable
              onPress={add}
              disabled={!name.trim()}
              className={`rounded-md px-5 items-center justify-center ${name.trim() ? "bg-ink" : "bg-hair"}`}
            >
              <Text className="text-paper-lit font-bold">Add</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
