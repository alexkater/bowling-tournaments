import { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, ScrollView } from 'react-native'
import { trpc } from '@/lib/api'

interface ProfileData {
  id: string
  firstName: string
  lastName: string
  email: string
  average: number | null
  handicap: number | null
  usbcId: string | null
  phone: string | null
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [tournamentCount, setTournamentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const fetchProfile = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      // Try to get the authenticated user's profile
      const me = await trpc.auth.me.query()
      setProfile(me as unknown as ProfileData)
      setIsLoggedIn(true)

      // Fetch tournament history count
      try {
        const history = await trpc.player.getTournaments.query()
        setTournamentCount(history.length)
      } catch {
        setTournamentCount(0)
      }
    } catch (err) {
      // Not authenticated or API unavailable — show login placeholder
      setIsLoggedIn(false)
      setProfile(null)
      setTournamentCount(0)
      if (err instanceof Error && err.message !== 'Not authenticated') {
        setError(err.message)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchProfile(true)} tintColor="#2563eb" />
      }
    >
      <Text style={styles.title}>Profile</Text>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {!isLoggedIn ? (
        <View style={styles.loginPrompt}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>?</Text>
          </View>
          <Text style={styles.loginTitle}>Not Signed In</Text>
          <Text style={styles.loginSubtitle}>Sign in to view your profile, tournament history, and more.</Text>
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signupButton}>
            <Text style={styles.signupButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      ) : profile ? (
        <>
          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.firstName[0]}{profile.lastName[0]}
                </Text>
              </View>
            </View>
            <Text style={styles.profileName}>{profile.firstName} {profile.lastName}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{tournamentCount}</Text>
              <Text style={styles.statLabel}>Tournaments</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.average ?? '—'}</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.handicap ?? '—'}</Text>
              <Text style={styles.statLabel}>Handicap</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>USBC ID</Text>
              <Text style={styles.detailValue}>{profile.usbcId ?? 'Not set'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{profile.phone ?? 'Not set'}</Text>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#0f172a' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center', marginBottom: 16 },

  // Login prompt
  loginPrompt: { alignItems: 'center', paddingTop: 40 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholderText: { fontSize: 32, fontWeight: '700', color: '#94a3b8' },
  loginTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  loginSubtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22, paddingHorizontal: 20 },
  loginButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signupButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signupButtonText: { color: '#334155', fontSize: 16, fontWeight: '600' },

  // Profile card
  profileCard: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { marginBottom: 12 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  profileEmail: { fontSize: 15, color: '#64748b' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#64748b' },

  // Details
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: { fontSize: 15, color: '#64748b' },
  detailValue: { fontSize: 15, fontWeight: '500', color: '#0f172a' },

  // Logout
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
})
