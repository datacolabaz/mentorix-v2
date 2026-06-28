import { useCallback, useEffect, useRef, useState } from 'react'

export function canUseLocalRecording() {
  if (typeof window === 'undefined') return false
  if (typeof MediaRecorder === 'undefined') return false
  if (!navigator.mediaDevices?.getDisplayMedia) return false
  return !/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
}

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

function buildStreamVariants(screenStream, micStream) {
  const screenVideo = screenStream.getVideoTracks()
  const screenAudio = screenStream.getAudioTracks()
  const micAudio = micStream?.getAudioTracks() || []

  const variants = []
  if (screenVideo.length) {
    if (screenAudio.length || micAudio.length) {
      variants.push(new MediaStream([...screenVideo, ...screenAudio, ...micAudio]))
    }
    if (screenAudio.length) {
      variants.push(new MediaStream([...screenVideo, ...screenAudio]))
    }
    variants.push(new MediaStream(screenVideo))
  }
  return variants
}

function createMediaRecorder(stream) {
  let lastError = null
  for (const mimeType of MIME_CANDIDATES) {
    if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) continue
    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      return recorder
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Bu brauzer ekran yazısını dəstəkləmir')
}

function startMediaRecorder(mediaRecorder) {
  try {
    mediaRecorder.start(1000)
  } catch {
    mediaRecorder.start()
  }
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
      'Record başlamaq üçün açılan pəncərədə