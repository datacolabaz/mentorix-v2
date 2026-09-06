import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { resolveApiAssetUrl } from '../../lib/apiAssetUrl'
import Button from '../common/Button'
import InstructorAvatar from '../common/InstructorAvatar'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export default function InstructorAvatarUpload({
  fullName,
  avatarUrl,
  onAvatarChange,
  mapKind = 'teacher',
  theme = 'dark',
}) {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [imgError, setImgError] = useState(false)

  const displaySrc = preview || (avatarUrl ? resolveApiAssetUrl(avatarUrl) : null)
  const showPhoto = Boolean(displaySrc) && !imgError

  useEffect(() => {
    setImgError(false)
  }, [displaySrc])

  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!ALLOWED.includes(file.type)) {
      setError(t('settings.avatarUpload.errType'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('settings.avatarUpload.errSize'))
      return
    }
    setPreview(URL.createObjectURL(file))
    void upload(file)
  }

  const upload = async (file) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const res = await api.post('/instructor/avatar', form)
      onAvatarChange?.(res.avatar_url || null)
      setPreview(null)
    } catch (err) {
      setError(err?.message || t('settings.avatarUpload.errUpload'))
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    setRemoving(true)
    setError(null)
    try {
      await api.delete('/instructor/avatar')
      onAvatarChange?.(null)
      setPreview(null)
    } catch (err) {
      setError(err?.message || t('settings.avatarUpload.errRemove'))
    } finally {
      setRemoving(false)
    }
  }

  const hintCls =
    theme === 'dark' ? 'text-amber-200/90 bg-amber-500/10 border-amber-500/25' : 'text-amber-900 bg-amber-50 border-amber-200'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div
          className="relative shrink-0 h-28 w-28 rounded-full overflow-hidden ring-4 ring-primary/30 shadow-lg bg-[#1a1a1a]"
          aria-label={showPhoto ? t('settings.avatarUpload.hasPhoto') : t('settings.avatarUpload.noPhoto')}
        >
          {showPhoto ? (
            <img
              src={displaySrc}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <InstructorAvatar
              fullName={fullName}
              avatarUrl={null}
              size="xl"
              kind={mapKind}
              className="!h-28 !w-28 !text-xl"
              ringClassName="ring-0"
            />
          )}
          {uploading ? (
            <span className="absolute inset-0 z-10 rounded-full bg-black/50 flex items-center justify-center text-xs text-white font-semibold">
              {t('settings.avatarUpload.uploading')}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <p className={`text-sm rounded-xl border px-3 py-2.5 leading-relaxed ${hintCls}`}>
            {t('settings.avatarUpload.hint')}
          </p>
          <p className="text-xs text-token-textMuted">{t('settings.avatarUpload.formats')}</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPick}
            />
            <Button
              type="button"
              disabled={uploading || removing}
              onClick={() => fileRef.current?.click()}
              className="justify-center"
            >
              {avatarUrl || preview ? t('settings.avatarUpload.change') : t('settings.avatarUpload.upload')}
            </Button>
            {avatarUrl ? (
              <Button
                type="button"
                variant="secondary"
                loading={removing}
                disabled={uploading}
                onClick={() => void remove()}
                className="justify-center"
              >
                {t('settings.avatarUpload.remove')}
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
