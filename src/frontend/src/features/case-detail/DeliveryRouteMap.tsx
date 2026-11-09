import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  warehouseName: string
  deliveryLabel: string
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
  progressLabel: string
  stage: 'at_warehouse' | 'ready' | 'on_way' | 'delivered'
}

type RouteInfo = {
  points: L.LatLngExpression[]
  distanceKm: number | null
  durationMin: number | null
}

function makePin(label: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:4px;
      background:${color};color:#fff;font:600 11px 'IBM Plex Sans',system-ui,sans-serif;
      border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.25);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

function formatDistance(km: number | null): string | null {
  if (km == null || Number.isNaN(km)) return null
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

function formatDuration(min: number | null): string | null {
  if (min == null || Number.isNaN(min)) return null
  if (min < 60) return `about ${Math.max(1, Math.round(min))} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `about ${h} h ${m} min` : `about ${h} h`
}

async function fetchRoadRoute(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
  signal: AbortSignal,
): Promise<RouteInfo> {
  const straight: RouteInfo = {
    points: [
      [fromLat, fromLon],
      [toLat, toLon],
    ],
    distanceKm: null,
    durationMin: null,
  }

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLon},${fromLat};${toLon},${toLat}` +
    `?overview=full&geometries=geojson`

  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return straight
    const data = (await res.json()) as {
      code?: string
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: { coordinates?: [number, number][] }
      }>
    }
    const route = data.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (data.code !== 'Ok' || !route || !coords?.length) return straight

    return {
      points: coords.map(([lon, lat]) => [lat, lon] as L.LatLngExpression),
      distanceKm: route.distance != null ? route.distance / 1000 : null,
      durationMin: route.duration != null ? route.duration / 60 : null,
    }
  } catch {
    return straight
  }
}

/**
 * OpenStreetMap with road route warehouse → customer delivery address.
 */
export function DeliveryRouteMap({
  warehouseName,
  deliveryLabel,
  fromLat,
  fromLon,
  toLat,
  toLon,
  progressLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [routeMeta, setRouteMeta] = useState<{
    distanceKm: number | null
    durationMin: number | null
  }>({ distanceKm: null, durationMin: null })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const abort = new AbortController()
    let cancelled = false

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const from: L.LatLngExpression = [fromLat, fromLon]
    const to: L.LatLngExpression = [toLat, toLon]

    L.marker(from, {
      icon: makePin('W', '#2563eb'),
      title: `${warehouseName} warehouse`,
    })
      .addTo(map)
      .bindPopup(
        `<strong>Leaving from</strong><br/>${warehouseName} warehouse`,
      )

    L.marker(to, {
      icon: makePin('D', '#059669'),
      title: `Delivering to · ${deliveryLabel}`,
    })
      .addTo(map)
      .bindPopup(
        `<strong>Delivering to</strong><br/>${deliveryLabel}`,
      )

    // Show endpoints immediately; replace with road path when ready.
    let line = L.polyline([from, to], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [36, 36], maxZoom: 12 })

    void fetchRoadRoute(fromLon, fromLat, toLon, toLat, abort.signal).then(
      (info) => {
        if (cancelled || !mapRef.current) return
        line.remove()
        line = L.polyline(info.points, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(map)
        map.fitBounds(line.getBounds(), { padding: [36, 36], maxZoom: 12 })
        setRouteMeta({
          distanceKm: info.distanceKm,
          durationMin: info.durationMin,
        })
        window.setTimeout(() => map.invalidateSize(), 40)
      },
    )

    const t = window.setTimeout(() => map.invalidateSize(), 80)

    return () => {
      cancelled = true
      abort.abort()
      window.clearTimeout(t)
      map.remove()
      mapRef.current = null
    }
  }, [warehouseName, deliveryLabel, fromLat, fromLon, toLat, toLon])

  const openFull =
    `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=` +
    `${fromLat}%2C${fromLon}%3B${toLat}%2C${toLon}`

  const distanceText = formatDistance(routeMeta.distanceKm)
  const durationText = formatDuration(routeMeta.durationMin)
  const summaryParts = [distanceText, durationText].filter(Boolean)

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <p className="text-xs font-medium text-foreground">Delivery route</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From {warehouseName} warehouse to {deliveryLabel}
            {summaryParts.length > 0 ? ` · ${summaryParts.join(' · ')}` : ''}
          </p>
        </div>
        <p className="rounded-sm border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
          {progressLabel}
        </p>
      </div>

      <div className="grid gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Leaving from · </span>
          <span className="font-medium text-foreground">
            {warehouseName} warehouse
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Delivering to · </span>
          <span className="font-medium text-foreground">{deliveryLabel}</span>
        </p>
      </div>

      <div ref={containerRef} className="h-64 w-full bg-muted" />

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground">
        <span>Blue line = planned road route · not a live truck tracker</span>
        <a
          href={openFull}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open full map
        </a>
      </div>
    </div>
  )
}
