import { IncidentCard } from '@/components/incident-card'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reported?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { reported } = await searchParams

  // Fetch approved incidents + user's own pending ones
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*, incident_categories(label, icon, color, slug)')
    .or(`status.eq.approved,and(reporter_id.eq.${user.id},status.eq.pending)`)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {reported && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ Your report has been submitted and is pending review.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Community Feed</h1>
            <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
          </div>
          <Link
            href="/report"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            + Report incident
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {incidents && incidents.length > 0 ? (
            incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} />)
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
              No incidents reported yet.{' '}
              <Link href="/report" className="text-zinc-600 underline underline-offset-2">
                Be the first to report one.
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
