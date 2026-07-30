import { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { trpc } from '@/lib/api'

interface StageInfo {
  id: string
  name: string
  sortOrder: number
}

interface TournamentDetail {
  id: string
  name: string
  description: string | null
  status: string
  category: string
  maxPlayers: number | null
  allowWaitlist: boolean
  startDate: string
  endDate: string
  registrationDeadline: string | null
  stages: StageInfo[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function statusColor(status: string): string {
  switch (status) {
    case 'published':
      return '#16a34a'
    case 'in_progress':
      return '#2563eb'
    case 'completed':
      return '#64748b'
    case 'draft':
      return '#f59e0b'
    case 'cancelled':
      return '#dc2626'
    default:
      return '#64748b'
  }
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [tournament, setTournament] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTournament = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const result = await trpc.tournament.byId.query(id)
      setTournament(result as unknown as TournamentDetail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTournament()
  }, [fetchTournament])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTournament}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Tournament not found</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{tournament.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(tournament.status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(tournament.status) }]}>
            {tournament.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {tournament.description && (
        <Text style={styles.description}>{tournament.description}</Text>
      )}

      {/* Info card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>{categoryLabel(tournament.category)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dates</Text>
          <Text style={styles.infoValue}>{formatDateRange(tournament.startDate, tournament.endDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Max Players</Text>
          <Text style={styles.infoValue}>{tournament.maxPlayers ?? 'Unlimited'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Waitlist</Text>
          <Text style={styles.infoValue}>{tournament.allowWaitlist ? 'Allowed' : 'Not allowed'}</Text>
        </View>
        {tournament.registrationDeadline && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Registration Deadline</Text>
            <Text style={styles.infoValue}>{formatDate(tournament.registrationDeadline)}</Text>
          </View>
        )}
      </View>

      {/* Stages */}
      {tournament.stages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stages</Text>
          {tournament.stages.map((stage, index) => (
            <View key={stage.id} style={styles.stageRow}>
              <View style={styles.stageNumber}>
                <Text style={styles.stageNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stageName}>{stage.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/standings/${tournament.id}`)}
        >
          <Text style={styles.actionButtonText}>View Standings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push(`/brackets/${tournament.id}`)}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>View Brackets</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  name: { fontSize: 24, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' as const },
  description: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 20 },

  // Info card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 15, color: '#64748b' },
  infoValue: { fontSize: 15, fontWeight: '500', color: '#0f172a', textAlign: 'right' as const, flex: 1, marginLeft: 16 },

  // Stages
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  stageNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stageNumberText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  stageName: { fontSize: 15, fontWeight: '500', color: '#0f172a' },

  // Actions
  actions: { gap: 12 },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionButtonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  actionButtonTextSecondary: { color: '#334155' },

  // Error
  errorText: { fontSize: 16, color: '#dc2626', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
