'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Category = {
  id: number
  slug: string
  label: string
  icon: string
}

type LocationResult = {
  display_name: string
  lat: string
  lon: string
}

export default function ReportPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationName, setLocationName] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationResults, setLocationResults] = useState<LocationResult[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient()
      const { data } = await supabase
        .from('incident_categories')
        .select('id, slug, label, icon')
        .order('display_order')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  function handleLocationSearch(query: string) {
    setLocationQuery(query)
    setCoords(null)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (query.length < 3) {
      setLocationResults([])
      return
    }
    searchTimeout.current = setTimeout(async () => {
      setLocationLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data: LocationResult[] = await res.json()
        setLocationResults(data)
      } catch {
        // silently fail — user can retry
      } finally {
        setLocationLoading(false)
      }
    }, 400)
  }

  function selectLocation(result: LocationResult) {
    setLocationName(result.display_name)
    setCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) })
    setLocationQuery(result.display_name)
    setLocationResults([])
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const name: string = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocationName(name)
          setLocationQuery(name)
        } catch {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocationName(fallback)
          setLocationQuery(fallback)
        }
        setLocationLoading(false)
      },
      (err) => {
        setError(`Could not get location: ${err.message}`)
        setLocationLoading(false)
      }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!categoryId) return setError('Please select an incident type')
    if (!coords) return setError('Please set a location')
    if (!title.trim()) return setError('Please add a title')

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('create_incident', {
      p_category_id: categoryId,
      p_title: title.trim(),
      p_description: description.trim(),
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_location_name: locationName,
    })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    router.push('/dashboard?reported=1')
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Report an incident</h1>
        <p className="mb-8 text-sm text-zinc-500">Help keep your neighbourhood safe</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Incident type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Incident type</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">Select a type…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Brief description of what happened"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Details <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Any additional details that might help…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          {/* Location */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Location</label>
            <div className="relative">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => handleLocationSearch(e.target.value)}
                placeholder="Search for an address…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              {locationResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg">
                  {locationResults.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => selectLocation(r)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locationLoading}
              className="mt-2 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
            >
              {locationLoading ? 'Locating…' : '📍 Use my current location'}
            </button>
            {coords && (
              <p className="mt-1 text-xs text-zinc-400">
                ✓ {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
