import { useState, useCallback, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { trpc } from '@/lib/api'
import type { StandingsEntry } from '@bowling/shared'

interface TournamentItem {
  id: string
  name: string
  status: string
}

export default function StandingsScreen() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [standings, setStandings] = useState<StandingsEntry[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingStandings, setLoadingStandings] = useState(false)
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

  const fetchStandings = useCallback(async (tournamentId: string, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoadingStandings(true)
      setError(null)

      const result = await trpc.standings.getByTournament.query(tournamentId)
      if (result.scope === 'combined') {
        setStandings(result.standings)
      } else {
        // Flatten per_squad standings into a single list with squad name prefix
        const flattened: StandingsEntry[] = result.standings.flatMap(
          (group: { squadId: string; squadName: string; entries: StandingsEntry[] }) =>
            group.entries.map((entry: StandingsEntry) => ({
              ...entry,
              playerName: `${entry.playerName} (${group.squadName})`,
            })),
        )
        setStandings(flattened)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standings')
      setStandings([])
    } finally {
      setLoadingStandings(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  const handleSelectTournament = useCallback((id: string) => {
    setSelectedTournamentId(id)
    fetchStandings(id)
  }, [fetchStandings])

  const handleRefresh = useCallback(() => {
    if (selectedTournamentId) {
      fetchStandings(selectedTournamentId, true)
    } else {
      fetchTournaments(true)
    }
  }, [selectedTournamentId, fetchStandings, fetchTournaments])

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
      <Text style={styles.title}>Live Standings</Text>

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

      {/* Standings */}
      {!selectedTournamentId ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Select a tournament to view standings</Text>
        </View>
      ) : loadingStandings && standings.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error && standings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => selectedTournamentId && fetchStandings(selectedTournamentId)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={standings}
          keyExtractor={(item, index) => `${item.playerId}-${index}`}
          contentContainerStyle={styles.standingsList}
          ListHeaderComponent={
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.rankCol]}>#</Text>
              <Text style={[styles.tableHeaderCell, styles.nameCol]}>Player</Text>
              <Text style={[styles.tableHeaderCell, styles.scoreCol]}>Score</Text>
              <Text style={[styles.tableHeaderCell, styles.behindCol]}>Behind</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.standingsRow, item.isCut && styles.cutRow]}>
              <Text style={[styles.cell, styles.rankCol, item.rank <= 3 && styles.topRank]}>
                {item.rank}
              </Text>
              <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
                {item.playerName}
              </Text>
              <Text style={[styles.cell, styles.scoreCol, styles.scoreValue]}>
                {item.totalHandicap > 0 ? item.totalHandicap : item.totalRaw}
              </Text>
              <Text style={[styles.cell, styles.behindCol, item.behind === 0 && styles.leaderText]}>
                {item.behind === 0 ? '—' : `-${item.behind}`}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No standings data available</Text>
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
  standingsList: { paddingHorizontal: 16, paddingBottom: 24 },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: '#e2e8f0', marginBottom: 4 },
  tableHeaderCell: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' as const },
  standingsRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  cutRow: { backgroundColor: '#fef2f2' },
  cell: { fontSize: 15, color: '#0f172a' },
  rankCol: { width: 36, textAlign: 'center' as const },
  nameCol: { flex: 1 },
  scoreCol: { width: 64, textAlign: 'right' as const },
  behindCol: { width: 64, textAlign: 'right' as const },
  topRank: { fontWeight: '700', color: '#2563eb' },
  scoreValue: { fontWeight: '600', fontVariant: ['tabular-nums'] as const },
  leaderText: { color: '#16a34a' },
  errorText: { fontSize: 16, color: '#dc2626', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#94a3b8' },
})
