import { useState, useCallback, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { trpc } from '@/lib/api'

interface TournamentItem {
  id: string
  name: string
  status: string
}

interface BracketPoolItem {
  id: string
  name: string
  type: string
  entryFee: number
  maxPlayers: number
  currentPlayers: number
  status: string
}

function formatEntryFee(cents: number): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}`
}

function bracketTypeLabel(type: string): string {
  switch (type) {
    case 'eight_person_forward':
      return '8-Person Forward'
    case 'eight_person_reverse':
      return '8-Person Reverse'
    case 'eight_person_eliminator':
      return 'Eliminator'
    case 'single_elimination':
      return 'Single Elimination'
    case 'double_elimination':
      return 'Double Elimination'
    default:
      return type.replace(/_/g, ' ')
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'open':
      return '#16a34a'
    case 'in_progress':
      return '#2563eb'
    case 'completed':
      return '#64748b'
    case 'shuffling':
      return '#f59e0b'
    case 'cancelled':
      return '#dc2626'
    default:
      return '#64748b'
  }
}

export default function BracketsScreen() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [pools, setPools] = useState<BracketPoolItem[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingPools, setLoadingPools] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoadingTournaments(true)
      setError(null)

      const result = await trpc.tournament.list.query({ limit: 50 })
      setTournaments(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments')
    } finally {
      setLoadingTournaments(false)
      setRefreshing(false)
    }
  }, [])

  const fetchPools = useCallback(async (tournamentId: string, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoadingPools(true)
      setError(null)

      const result = await trpc.bracket.list.query({ tournamentId })
      setPools(result as unknown as BracketPoolItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brackets')
      setPools([])
    } finally {
      setLoadingPools(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  const handleSelectTournament = useCallback((id: string) => {
    setSelectedTournamentId(id)
    fetchPools(id)
  }, [fetchPools])

  const handleRefresh = useCallback(() => {
    if (selectedTournamentId) {
      fetchPools(selectedTournamentId, true)
    } else {
      fetchTournaments(true)
    }
  }, [selectedTournamentId, fetchPools, fetchTournaments])

  if (loadingTournaments && tournaments.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (error && tournaments.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchTournaments()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Brackets</Text>

      {/* Tournament selector */}
      <FlatList
        horizontal
        data={tournaments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tournamentStrip}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.tournamentChip,
              selectedTournamentId === item.id && styles.tournamentChipActive,
            ]}
            onPress={() => handleSelectTournament(item.id)}
          >
            <Text
              style={[
                styles.tournamentChipText,
                selectedTournamentId === item.id && styles.tournamentChipTextActive,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Bracket pools */}
      {!selectedTournamentId ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Select a tournament to view brackets</Text>
        </View>
      ) : loadingPools && pools.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error && pools.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => selectedTournamentId && fetchPools(selectedTournamentId)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.poolsList}
          renderItem={({ item }) => (
            <View style={styles.poolCard}>
              <View style={styles.poolHeader}>
                <Text style={styles.poolName} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <View style={styles.poolDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{bracketTypeLabel(item.type)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entry Fee</Text>
                  <Text style={styles.detailValue}>{formatEntryFee(item.entryFee)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Players</Text>
                  <Text style={styles.detailValue}>{item.currentPlayers} / {item.maxPlayers}</Text>
                </View>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No bracket pools for this tournament</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 },
  centered: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12, color: '#0f172a' },
  tournamentStrip: { paddingHorizontal: 16, paddingBottom: 12 },
  tournamentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  tournamentChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tournamentChipText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  tournamentChipTextActive: { color: '#fff' },
  poolsList: { paddingHorizontal: 16, paddingBottom: 24 },
  poolCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  poolName: { fontSize: 17, fontWeight: '600', color: '#0f172a', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as const },
  poolDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  errorText: { fontSize: 16, color: '#dc2626', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#94a3b8' },
})
