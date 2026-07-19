import { Tabs } from "expo-router";
import { View } from "react-native";
import { usePalette } from "@/lib/theme";

function Dot({ color, active }: { color: string; active: boolean }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: active ? color : "transparent",
      }}
    />
  );
}

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.ink,
        tabBarInactiveTintColor: p.carbon,
        tabBarStyle: { backgroundColor: p.paperLit, borderTopColor: p.hair },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <Dot color={p.ink} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ focused }) => <Dot color={p.ink} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <Dot color={p.ink} active={focused} />,
        }}
      />
    </Tabs>
  );
}
