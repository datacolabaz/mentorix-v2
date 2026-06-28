import { useCallback, useEffect, useRef, useState } from 'react'

export function canUseLocalRecording() {
  if (typeof window === 'undefined') return false
  if (typeof MediaRecorder === 'undefined') return false
  if (!navigator.mediaDevices?.getDisplayMedia) return false
  return !/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
}

function pickVideoMimeType() {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
    return 'video/webm;codecs=vp9,opus'
  }
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    return 'video/webm;codecs=vp8,opus'
  }
  return 'video/webm'
}

export function useLocalRecording() {
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamsRef = useRef([])
  const timerRef = useRef(null)
  const stopRecordingRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const [lastBlob, setLastBlob] = useState(null)
  const [recordingUrl, setRecordingUrl] = useState(null)
  const supported = canUseLocalRecording()

  const stopStreams = useCallback(() => {
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamsRef.current = []
  }, [])

  const clearRecordingUrl = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    setRecordingUrl(null)
  }, [recordingUrl])

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        const mimeType = mediaRecorder.mimeType || 'video/webm'
        const blob =
          chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: mimeType }) : null
        chunksRef.current = []

        mediaRecorder.stream?.getTracks?.().forEach((t) => t.stop())
        stopStreams()

        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob)
          setLastBlob(blob)
          setRecordingUrl(url)
          setIsRecording(false)
          resolve(blob)
          return
        }

        setIsRecording(false)
        resolve(null)
      }

      try {
        mediaRecorder.stop()
      } catch {
        setIsRecording(false)
        resolve(null)
      }
      mediaRecorderRef.current = null
    })
  }, [stopStreams])

  stopRecordingRef.current = stopRecording

  const startRecording = useCallback(async () => {
    if (!supported || isRecording) return { status: 'busy' }

    chunksRef.current = []
    setLastBlob(null)
    clearRecordingUrl()

    const confirmed = window.confirm(
      'Record başlamaq üçün açılan pəncərədə "Bu tab" və ya "Bütün ekran" seçin.\n\nJitsi-də ekran paylaşımı aktivdirsə, əvvəlcə onu dayandırın.',
    )
    if (!confirmed) return { status: 'cancelled' }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 24 },
        audio: true,
      })

      if (!screenStream?.getTracks?.().length) {
        screenStream?.getTracks?.().forEach((t) => t.stop())
        return { status: 'cancelled' }
      }

      let micStream = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        /* mikrofon olmadan da ekran yazısı mümkündür */
      }

      streamsRef.current = [screenStream, micStream].filter(Boolean)

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...(micStream?.getAudioTracks() || []),
        ...screenStream.getAudioTracks(),
      ])

      const videoTrack = screenStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          void stopRecordingRef.current?.()
        })
      }

      const mimeType = pickVideoMimeType()
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setDurationSec(0)
      timerRef.current = window.setInterval(() => setDurationSec((s) => s + 1), 1000)
      return { status: 'started' }
    } catch (err) {
      stopStreams()
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        return { status: 'cancelled' }
      }
      throw err
    }
  }, [supported, isRecording, clearRecordingUrl, stopStreams])

  const downloadRecording = useCallback(
    (blob = lastBlob, filename) => {
      const target = blob || lastBlob
      const href = recordingUrl || (target ? URL.createObjectURL(target) : null)
      if (!href) return
      const a = document.createElement('a')
      a.href = href
      a.download = filename || `mentorix-ders-${new Date().toISOString().slice(0, 10)}.webm`
      a.click()
      if (!recordingUrl && href) URL.revokeObjectURL(href)
    },
    [lastBlob, recordingUrl],
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      stopStreams()
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    },
    [stopStreams, recordingUrl],
  )

  return {
    supported,
    isRecording,
    durationSec,
    lastBlob,
    recordingUrl,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecordingUrl,
  }
}

export function formatRecordingDuration(totalSec) {
  const s = Math.max(0, Number(totalSec) || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
