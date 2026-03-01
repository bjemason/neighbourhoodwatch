import { relativeTime } from '@/lib/utils'

type Incident = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  photo_url: string | null
  status: string
  created_at: string
  incident_categories: {
    label: string
    icon: string
    color: string
    slug: string
  } | null
}

export function IncidentCard({ incident }: { incident: Incident }) {
  const category = incident.incident_categories
  const isPending = incident.status === 'pending'

  return (
    <div className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm">
      {/* Category icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg">
        {category?.icon ?? '📋'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category badge */}
          {category && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {category.label}
            </span>
          )}
          {/* Pending badge */}
          {isPending && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              Pending review
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-zinc-400">
            {relativeTime(incident.created_at)}
          </span>
        </div>

        <p className="mt-1 font-medium text-zinc-900">{incident.title}</p>

        {incident.location_name && (
          <p className="mt-0.5 truncate text-sm text-zinc-500">📍 {incident.location_name}</p>
        )}

        {incident.description && (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{incident.description}</p>
        )}
      </div>

      {/* Photo thumbnail */}
      {incident.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={incident.photo_url}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
      )}
    </div>
  )
}
