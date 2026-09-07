import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Brand from '../../components/common/Brand'
import NavIcon from '../../components/common/NavIcon'
import { useToast } from '../../components/common/Toast'
import { dashboardPathForRole } from '../../lib/postAuth'
import {
  PERSONA_ORDER,
  PERSONA_UI,
  PERSONAS,
  userNeedsOnboarding,
} from '../../constants/personas'

const inputClass =
  'w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20'

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function SelectField({ id, value, onChange, options, placeholder }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function emptyProfile() {
  return {
    subject: '',
    teaching_format: '',
    student_count: '',
    center_name: '',
    teacher_count: '',
    exam_purpose: '',
    education_level: '',
    subject_interest: '',
    child_count: '',
    follow_focus: '',
    company_name: '',
    company_size: '',
    purpose_text: '',
  }
}

function profileComplete(persona, p) {
  switch (persona) {
    case PERSONAS.TEACHER:
      return Boolean(p.subject && p.teaching_format && p.student_count)
    case PERSONAS.EDUCATION_CENTER:
      return Boolean(p.center_name && p.teacher_count && p.student_count && p.exam_purpose)
    case PERSONAS.STUDENT:
      return Boolean(p.education_level && p.subject_interest)
    case PERSONAS.PARENT:
      return Boolean(p.child_count)
    case PERSONAS.HR_COMPANY:
      return Boolean(p.company_name && p.company_size && p.exam_purpose)
    case PERSONAS.OTHER:
      return Boolean(String(p.purpose_text || '').trim())
    default:
      return false
  }
}

function PersonaDetailsForm({ persona, profile, setProfile, t }) {
  const set = (key) => (value) => setProfile((prev) => ({ ...prev, [key]: value }))
  const opt = (prefix, values) => values.map((value) => ({ value, label: t(`${prefix}.${value}`) }))

  if (persona === PERSONAS.TEACHER) {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="mx-ob-subject">{t('onboarding.fields.subject')}</FieldLabel>
          <input
            id="mx-ob-subject"
            className={inputClass}
            value={profile.subject}
            onChange={(e) => set('subject')(e.target.value)}
            placeholder={t('onboarding.fields.subjectPlaceholder')}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-format">{t('onboarding.fields.teachingFormat')}</FieldLabel>
          <SelectField
            id="mx-ob-format"
            value={profile.teaching_format}
            onChange={set('teaching_format')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.teachingFormat', ['individual', 'group', 'online', 'hybrid'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-students">{t('onboarding.fields.studentCount')}</FieldLabel>
          <SelectField
            id="mx-ob-students"
            value={profile.student_count}
            onChange={set('student_count')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.studentCount', ['1-5', '6-15', '16-40', '40+'])}
          />
        </div>
      </div>
    )
  }

  if (persona === PERSONAS.EDUCATION_CENTER) {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="mx-ob-center">{t('onboarding.fields.centerName')}</FieldLabel>
          <input
            id="mx-ob-center"
            className={inputClass}
            value={profile.center_name}
            onChange={(e) => set('center_name')(e.target.value)}
            placeholder={t('onboarding.fields.centerNamePlaceholder')}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-teachers">{t('onboarding.fields.teacherCount')}</FieldLabel>
          <SelectField
            id="mx-ob-teachers"
            value={profile.teacher_count}
            onChange={set('teacher_count')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.teacherCount', ['1-3', '4-10', '11-30', '30+'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-cstudents">{t('onboarding.fields.centerStudentCount')}</FieldLabel>
          <SelectField
            id="mx-ob-cstudents"
            value={profile.student_count}
            onChange={set('student_count')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.centerStudentCount', ['1-20', '21-80', '81-200', '200+'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-purpose">{t('onboarding.fields.centerExamPurpose')}</FieldLabel>
          <input
            id="mx-ob-purpose"
            className={inputClass}
            value={profile.exam_purpose}
            onChange={(e) => set('exam_purpose')(e.target.value)}
            placeholder={t('onboarding.fields.centerExamPurposePlaceholder')}
          />
        </div>
      </div>
    )
  }

  if (persona === PERSONAS.STUDENT) {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="mx-ob-level">{t('onboarding.fields.educationLevel')}</FieldLabel>
          <SelectField
            id="mx-ob-level"
            value={profile.education_level}
            onChange={set('education_level')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.educationLevel', ['school', 'college', 'university', 'other'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-interest">{t('onboarding.fields.subjectInterest')}</FieldLabel>
          <input
            id="mx-ob-interest"
            className={inputClass}
            value={profile.subject_interest}
            onChange={(e) => set('subject_interest')(e.target.value)}
            placeholder={t('onboarding.fields.subjectInterestPlaceholder')}
          />
        </div>
      </div>
    )
  }

  if (persona === PERSONAS.PARENT) {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="mx-ob-children">{t('onboarding.fields.childCount')}</FieldLabel>
          <SelectField
            id="mx-ob-children"
            value={profile.child_count}
            onChange={set('child_count')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.childCount', ['1', '2', '3+'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-focus">{t('onboarding.fields.followFocus')}</FieldLabel>
          <SelectField
            id="mx-ob-focus"
            value={profile.follow_focus}
            onChange={set('follow_focus')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.followFocus', ['exams', 'progress', 'both'])}
          />
        </div>
      </div>
    )
  }

  if (persona === PERSONAS.HR_COMPANY) {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="mx-ob-company">{t('onboarding.fields.companyName')}</FieldLabel>
          <input
            id="mx-ob-company"
            className={inputClass}
            value={profile.company_name}
            onChange={(e) => set('company_name')(e.target.value)}
            placeholder={t('onboarding.fields.companyNamePlaceholder')}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-size">{t('onboarding.fields.companySize')}</FieldLabel>
          <SelectField
            id="mx-ob-size"
            value={profile.company_size}
            onChange={set('company_size')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.companySize', ['1-10', '11-50', '51-200', '201-1000', '1000+'])}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mx-ob-hrexam">{t('onboarding.fields.hrExamPurpose')}</FieldLabel>
          <SelectField
            id="mx-ob-hrexam"
            value={profile.exam_purpose}
            onChange={set('exam_purpose')}
            placeholder={t('onboarding.fields.select')}
            options={opt('onboarding.options.hrExamPurpose', [
              'hiring',
              'candidate_assessment',
              'employee_assessment',
              'training_certification',
              'other',
            ])}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <FieldLabel htmlFor="mx-ob-other">{t('onboarding.fields.otherPurpose')}</FieldLabel>
      <textarea
        id="mx-ob-other"
        className={`${inputClass} min-h-[120px] resize-y`}
        value={profile.purpose_text}
        onChange={(e) => set('purpose_text')(e.target.value)}
        placeholder={t('onboarding.fields.otherPurposePlaceholder')}
        maxLength={400}
      />
    </div>
  )
}

export default function PersonaOnboarding() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { user, token, setSession, logout } = useAuthStore()
  const [step, setStep] = useState('pick')
  const [picked, setPicked] = useState(null)
  const [profile, setProfile] = useState(emptyProfile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const selectedUi = picked ? PERSONA_UI[picked] : null
  const canFinish = useMemo(() => profileComplete(picked, profile), [picked, profile])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#07090c]">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#10141b] p-6 text-center">
          <Brand size="md" tone="dark" centered />
          <h1 className="mt-5 text-white font-display font-bold text-xl">{t('onboarding.unauthorizedTitle')}</h1>
          <p className="mt-2 text-sm text-gray-400">{t('onboarding.unauthorizedBody')}</p>
          <Button className="w-full justify-center mt-5" onClick={() => navigate('/login')}>
            {t('auth.login')}
          </Button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    if (!picked || !canFinish) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.post('/auth/onboarding/persona', { persona: picked, profile })
      if (!r?.token || !r?.user) throw new Error(r?.message || t('auth.errors.invalidServer'))
      setSession(r.token, r.user)
      toast(t('onboarding.toasts.ready'), 'success')
      navigate(dashboardPathForRole(r.user.role), { replace: true })
    } catch (e) {
      const msg = e?.message || e?.response?.data?.message || t('onboarding.toasts.failed')
      setError(msg)
      toast(msg, 'error')
      const st = e?.status ?? e?.response?.status
      if (st === 401 || st === 403) {
        logout()
        navigate('/login', { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090c] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex justify-center mb-8">
          <Brand size="login" tone="dark" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#10141b] p-5 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {step === 'pick' ? (
            <>
              <div className="text-center max-w-xl mx-auto">
                <h1 className="text-white font-display font-bold text-2xl sm:text-[1.75rem] leading-tight">
                  {t('onboarding.title')}
                </h1>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{t('onboarding.subtitle')}</p>
                {user?.email ? (
                  <p className="mt-2 text-xs text-gray-500">
                    {t('onboarding.forAccount', { email: user.email })}
                  </p>
                ) : null}
              </div>

              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERSONA_ORDER.map((id) => {
                  const meta = PERSONA_UI[id]
                  const selected = picked === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPicked(id)}
                      className={[
                        'text-left rounded-2xl border p-4 transition-all duration-200 min-h-[112px]',
                        'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.06]',
                        selected
                          ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(34,224,136,0.35)]'
                          : 'border-white/10 bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={[
                            'mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                            selected
                              ? 'bg-primary/20 border-primary/40 text-primary'
                              : 'bg-white/5 border-white/10 text-gray-300',
                          ].join(' ')}
                        >
                          <NavIcon name={meta.icon} className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <div className={`font-semibold ${selected ? 'text-white' : 'text-gray-100'}`}>
                            {t(meta.titleKey)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1 leading-relaxed">{t(meta.descKey)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Button
                className="w-full justify-center mt-6"
                disabled={!picked}
                onClick={() => picked && setStep('details')}
              >
                {t('onboarding.continue')}
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-xs font-semibold text-gray-400 hover:text-white mb-4"
                onClick={() => setStep('pick')}
              >
                ← {t('common.back')}
              </button>
              <div className="flex items-start gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/40 text-primary shrink-0">
                  <NavIcon name={selectedUi?.icon} className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-white font-display font-bold text-xl">{t(selectedUi?.titleKey)}</h2>
                  <p className="text-sm text-gray-400 mt-1">{t('onboarding.detailsHint')}</p>
                </div>
              </div>

              <PersonaDetailsForm persona={picked} profile={profile} setProfile={setProfile} t={t} />

              {error ? (
                <p className="mt-4 text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                className="w-full justify-center mt-6"
                loading={busy}
                disabled={!canFinish}
                onClick={() => void submit()}
              >
                {t('onboarding.continue')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PersonaOnboardingGate() {
  const { user } = useAuthStore()
  return userNeedsOnboarding(user)
}
