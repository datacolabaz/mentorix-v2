import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { livePresentationFileUrl } from '../lib/presentationFileUrl'
import usePdfDocument from './usePdfDocument'
import usePresentationAnnotations from './usePresentationAnnotations'

export default function useLivePresentation({
  roomCode,
  isInstructor,
  presentationEvent,
  sendPresentationEvent,
}) {
  const [presentation, setPresentation] = useState(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [initialAnnotations, setInitialAnnotations] = useState({})
  const [poll, setPoll] = useState(null)
  const [loading, setLoading] = useState(false)

  const hydrate = useCallback(async () => {
    if (!roomCode) return
    try {
      const res = await api.get(`/live/${encodeURIComponent(roomCode)}/presentation`)
      if (!res?.success) return
      setPresentation(res.presentation || null)
      setSlideIndex(Number(res.slide_index) || 0)
      setInitialAnnotations(res.annotations || {})
      setPoll(res.poll || null)
    } catch {
      /* late join hydrate is best-effort */
    }
  }, [roomCode])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const fileUrl = useMemo(
    () => (presentation && roomCode ? livePresentationFileUrl(roomCode) : ''),
    [presentation, roomCode],
  )
  const { pdf, pageCount, loading: pdfLoading } = usePdfDocument(fileUrl)
  const annotations = usePresentationAnnotations(presentation?.id, initialAnnotations, {
    persist: Boolean(isInstructor && presentation?.id),
  })

  useEffect(() => {
    const ev = presentationEvent
    if (!ev) return
    if (ev.t === 'pres_open') {
      void hydrate()
      return
    }
    if (ev.t === 'pres_close') {
      setPresentation(null)
      setPoll(null)
      setSlideIndex(0)
      return
    }
    if (ev.t === 'pres_slide' && Number.isFinite(Number(ev.slideIndex))) {
      setSlideIndex(Math.max(0, Math.round(Number(ev.slideIndex))))
      return
    }
    if (ev.t === 'pres_strokes' && ev.strokes) {
      annotations.applyRemote(Number(ev.slideIndex) || 0, ev.strokes)
      return
    }
    if (ev.t === 'pres_poll') {
      setPoll(ev.poll || null)
      return
    }
    if (ev.t === 'pres_vote' && ev.poll) {
      setPoll(ev.poll)
    }
  }, [presentationEvent, hydrate, annotations.applyRemote])

  useEffect(() => {
    if (!pageCount || !presentation) return
    if (slideIndex > pageCount - 1) setSlideIndex(pageCount - 1)
  }, [pageCount, presentation, slideIndex])

  const persistState = useCallback(
    async (body) => {
      if (!roomCode || !isInstructor) return
      try {
        await api.put(`/live/${encodeURIComponent(roomCode)}/presentation`, body)
      } catch {
        /* keep local */
      }
    },
    [roomCode, isInstructor],
  )

  const openPresentation = useCallback(
    async (row) => {
      if (!row?.id) return
      setLoading(true)
      try {
        const res = await api.put(`/live/${encodeURIComponent(roomCode)}/presentation`, {
          presentation_id: row.id,
          slide_index: 0,
        })
        setPresentation(res.presentation || row)
        setSlideIndex(0)
        setInitialAnnotations(res.annotations || {})
        setPoll(res.poll || null)
        await sendPresentationEvent({ t: 'pres_open', presentationId: row.id, slideIndex: 0 })
      } finally {
        setLoading(false)
      }
    },
    [roomCode, sendPresentationEvent],
  )

  const closePresentation = useCallback(async () => {
    await persistState({ close: true })
    setPresentation(null)
    setPoll(null)
    setSlideIndex(0)
    await sendPresentationEvent({ t: 'pres_close' })
  }, [persistState, sendPresentationEvent])

  const goSlide = useCallback(
    async (nextIndex) => {
      if (!pageCount) return
      const idx = Math.min(pageCount - 1, Math.max(0, nextIndex))
      setSlideIndex(idx)
      await persistState({ slide_index: idx })
      await sendPresentationEvent({ t: 'pres_slide', slideIndex: idx })
    },
    [pageCount, persistState, sendPresentationEvent],
  )

  const commitStrokes = useCallback(
    (next, { recordHistory = true } = {}) => {
      annotations.setSlideStrokes(slideIndex, next, { recordHistory })
      void sendPresentationEvent({ t: 'pres_strokes', slideIndex, strokes: next })
    },
    [annotations, slideIndex, sendPresentationEvent],
  )

  const syncStrokes = useCallback(
    (next) => {
      if (!next) return
      void sendPresentationEvent({ t: 'pres_strokes', slideIndex, strokes: next })
    },
    [slideIndex, sendPresentationEvent],
  )

  const startPoll = useCallback(
    async ({ question, options, kind, correct_option_id }) => {
      const res = await api.post(`/live/${encodeURIComponent(roomCode)}/polls`, {
        question,
        options,
        kind,
        correct_option_id,
      })
      if (res?.poll) {
        setPoll(res.poll)
        await sendPresentationEvent({ t: 'pres_poll', poll: res.poll })
      }
      return res?.poll
    },
    [roomCode, sendPresentationEvent],
  )

  const votePoll = useCallback(
    async (optionId) => {
      if (!poll?.id) return
      const res = await api.post(`/live/${encodeURIComponent(roomCode)}/polls/${poll.id}/respond`, {
        option_id: optionId,
      })
      if (res?.poll) {
        setPoll(res.poll)
        await sendPresentationEvent({ t: 'pres_vote', poll: res.poll })
      }
    },
    [poll, roomCode, sendPresentationEvent],
  )

  const closePoll = useCallback(async () => {
    if (!poll?.id) return
    const res = await api.post(`/live/${encodeURIComponent(roomCode)}/polls/${poll.id}/close`)
    if (res?.poll) {
      setPoll(res.poll)
      await sendPresentationEvent({ t: 'pres_vote', poll: res.poll })
    }
  }, [poll, roomCode, sendPresentationEvent])

  return {
    presentation,
    slideIndex,
    page: slideIndex + 1,
    pageCount,
    pdf,
    pdfLoading,
    loading,
    poll,
    annotations,
    openPresentation,
    closePresentation,
    goSlide,
    commitStrokes,
    syncStrokes,
    startPoll,
    votePoll,
    closePoll,
  }
}
