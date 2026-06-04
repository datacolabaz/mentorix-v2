import { useMemo } from 'react'
import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { formatDistanceKm } from '../../lib/geo'
import { resolveApiAssetUrl } from '../../lib/apiAssetUrl'
import { instructorInitials } from '../../lib/instructorInitials'

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

function createPinIcon({ initial, avatarSrc, distanceLabel, isNearest, kind, selected }) {
  const color = kind === 'trainer' ? '#f97316' : '#22c55e'
  const ring = isNearest ? '#fbbf24' : '#ffffff'
  const size = selected ? 40 : isNearest ? 38 : 34
  const glow = isNearest
    ? '0 0 16px rgba(251,191,36,0.9), 0 4px 12px rgba(0,0,0,.5)'
    : '0 4px 12px rgba(0,0,0,.45)'
  const inner = avatarSrc
    ? `<img src="${avatarSrc.replace(/"/g, '&quot;')}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />`
    : initial

  return L.divIcon({
    className: 'mentorix-instructor-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:none;">
        ${
          isNearest
            ? '<div style="font-size:9px;font-weight:800;color:#fbbf24;letter-spacing:.02em;margin-bottom:3px;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.8);">⭐ Ən yaxın</div>'
            : ''
        }
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(145deg,${color},#0f172a);border:3px solid ${ring};box-shadow:${glow};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${selected ? 15 : 13}px;color:#fff;font-family:system-ui,sans-serif;overflow:hidden;">${inner}</div>
        <div style="margin-top:4px;font-size:10px;font-weight:700;color:#ecfdf5;background:rgba(0,0,0,.82);border:1px solid rgba(255,255,255,.15);padding:2px 7px;border-radius:8px;white-space:nowrap;">${distanceLabel}</div>
      </div>
    `.replace(/div/g, 'div'),
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export default function InstructorMapMarker({ instructor, isNearest, selected, onSelect }) {
  const initial = instructorInitials(instructor.full_name).replace(/\./g, '') || 'M'
  const avatarSrc = instructor.avatar_url ? resolveApiAssetUrl(instructor.avatar_url) : ''
  const distanceLabel = formatDistanceKm(instructor.distanceKm)

  const icon = useMemo(
    () =>
      createPinIcon({
        initial,
        avatarSrc,
        distanceLabel,
        isNearest,
        kind: instructor.map_profile_kind,
        selected,
      }),
    [initial, avatarSrc, distanceLabel, isNearest, instructor.map_profile_kind, selected],
  )

  return (
    <Marker
      position={[instructor.latitude, instructor.longitude]}
      icon={icon}
      zIndexOffset={isNearest ? 2000 : selected ? 1500 : 500}
      eventHandlers={{
        click: () => onSelect?.(instructor),
      }}
    >
      <Popup>
        <div className="text-gray-900 text-sm min-w-[200px]">
          {isNearest ? (
            <div className="text-[10px] font-bold text-amber-600 mb-1">⭐ Ən yaxın</div>
          ) : null}
          <div className="font-bold">{instructor.full_name}</div>
          <div className="text-gray-600 text-xs mt-1">
            {instructor.display_subject || instructor.subject || '—'}
          </div>
          <div className="text-[11px] mt-1 font-semibold text-emerald-700">{distanceLabel} · sizdən</div>
          <div className="text-[11px] text-gray-500">{kindLabel(instructor.map_profile_kind)}</div>
        </div>
      </Popup>
    </Marker>
  )
}
