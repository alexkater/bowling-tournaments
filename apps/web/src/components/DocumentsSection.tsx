'use client'

import { trpc } from '@/lib/trpc-provider'
import { FileText, Download, Loader2 } from 'lucide-react'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export function DocumentsSection({ tournamentId }: { tournamentId: string }) {
  const docsQuery = trpc.tournament.documents.useQuery(
    { tournamentId },
    { enabled: Boolean(tournamentId) },
  )

  if (docsQuery.isLoading) {
    return (
      <div className="mt-10">
        <h2 className="text-xl font-bold text-white">Documents</h2>
        <div className="mt-4 flex items-center gap-2 text-steel-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading documents...</span>
        </div>
      </div>
    )
  }

  const docs = docsQuery.data ?? []
  if (docs.length === 0) return null

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-white">Documents</h2>
      <div className="mt-4 space-y-3">
        {docs.map((doc) => (
          <a
            key={doc.id}
            href={`${API_BASE}/api/documents/${doc.id}/download`}
            download={doc.fileName}
            className="flex items-center gap-4 rounded-2xl border border-white/5 bg-ink-800/60 p-5 transition hover:border-pin-400/30 hover:bg-ink-800/80 group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-400/10 text-blue-300">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white group-hover:text-pin-300 transition truncate">
                {doc.title}
              </h3>
              {doc.description && (
                <p className="mt-0.5 text-sm text-steel-500 truncate">{doc.description}</p>
              )}
              <p className="mt-1 text-xs text-steel-600">
                {doc.fileName} · {formatFileSize(doc.fileSize)}
              </p>
            </div>
            <Download className="h-5 w-5 shrink-0 text-steel-600 group-hover:text-pin-400 transition" />
          </a>
        ))}
      </div>
    </div>
  )
}
