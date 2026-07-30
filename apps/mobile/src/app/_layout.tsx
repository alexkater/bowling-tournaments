import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tournament/[id]" options={{ headerShown: true, title: 'Tournament' }} />
        <Stack.Screen name="standings/[id]" options={{ headerShown: true, title: 'Standings' }} />
        <Stack.Screen name="brackets/[id]" options={{ headerShown: true, title: 'Brackets' }} />
      </Stack>
    </>
  )
}
