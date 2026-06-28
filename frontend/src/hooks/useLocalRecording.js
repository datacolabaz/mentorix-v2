import { useCallback, useEffect, useRef, useState } from 'react'

export function canUseLocalRecording() {
  if (typeof window === 'undefined') return false
  if (typeof MediaRecorder === 'undefined') return false
  if (!navigator.mediaDevices?.getDisplayMedia) return false
  return !/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
}

export function useLocalRecording() {
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamsRef = useRef([])
  const timerRef = useRef(null)
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

  const startRecording = useCallback(async () => {
    if (!supported || isRecording) return false
    chunksRef.current = []
    setLastBlob(null)
    clearRecordingUrl()

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
    })
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamsRef.current = [screenStream, micStream]

    const combinedStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...micStream.getAudioTracks(),
      ...screenStream.getAudioTracks(),
    ])

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'

    const mediaRecorder = new MediaRecorder(combinedStream, { mimeType })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorder.start(1000)
    mediaRecorderRef.current = mediaRecorder
    setIsRecording(true)
    setDurationSec(0)
    timerRef.current = window.setInterval(() => setDurationSec((s) => s + 1), 1000)
    return true
  }, [supported, isRecording, clearRecordingUrl])

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
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        chunksRef.current = []
        const url = URL.createObjectURL(blob)
        setLastBlob(blob)
        setRecordingUrl(url)
        setIsRecording(false)
        stopStreams()
        resolve(blob)
      }
      mediaRecorder.stop()
      mediaRecorderRef.current = null
    })
  }, [stopStreams])

  const downloadRecording = useCallback(
    (blob = lastBlob, filename) => {
      const target = blob || (recordingUrl ? lastBlob : null)
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
