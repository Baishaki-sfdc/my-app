// components/voice-to-image-generator/index.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useReactMediaRecorder } from 'react-media-recorder'
import { Mic, StopCircle, Image, Redo } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const VoiceToImageGeneratorComponent = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [generatedImage, setGeneratedImage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [editablePrompt, setEditablePrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<Blob | null>(null)

  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl
  } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => {
      audioRef.current = blob
    },
  })

  useEffect(() => {
    return () => {
      clearBlobUrl()
    }
  }, [clearBlobUrl])

  const handleStartRecording = async () => {
    try {
      setError(null)
      setIsRecording(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      startRecording()
    } catch (err) {
      setError('Microphone permission denied. Please allow microphone access.')
      setIsRecording(false)
    }
  }

  const handleStopRecording = async () => {
    setIsRecording(false)
    stopRecording()
    setIsProcessing(true)
    setError(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 500))

      if (!audioRef.current) {
        throw new Error('No audio recording available')
      }

      const formData = new FormData()
      formData.append('audio', audioRef.current, 'recording.webm')

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json()
        throw new Error(errorData.error || 'Failed to transcribe audio')
      }

      const { transcript } = await transcribeResponse.json()

      const promptResponse = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      if (!promptResponse.ok) {
        const errorData = await promptResponse.json()
        throw new Error(errorData.error || 'Failed to generate prompt')
      }

      const { prompt } = await promptResponse.json()
      setGeneratedPrompt(prompt)
      setEditablePrompt(prompt)
    } catch (error) {
      console.error('Error processing audio:', error)
      setError(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setIsProcessing(false)
      audioRef.current = null
    }
  }

  const handlePromptEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditablePrompt(e.target.value)
  }

  const handleRegenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editablePrompt }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }
      const { imageUrl } = await response.json()
      setGeneratedImage(imageUrl)
    } catch (error) {
      console.error('Error generating image:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Voice to Image Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {!isRecording ? (
              <Button
                size="lg"
                variant="outline"
                className="w-24 h-24 rounded-full"
                onClick={handleStartRecording}
              >
                <Mic className="h-12 w-12" />
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-24 h-24 rounded-full animate-pulse"
                onClick={handleStopRecording}
              >
                <StopCircle className="h-12 w-12" />
              </Button>
            )}
          </div>
          <p className="text-center">
            {isRecording ? "Recording... Tap to stop" : "Tap the microphone to start recording"}
          </p>
          {isProcessing && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2">Processing audio...</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              <p>{error}</p>
            </div>
          )}
          {generatedPrompt && !isGenerating && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                  Generated Prompt (you can edit):
                </label>
                <textarea
                  id="prompt"
                  value={editablePrompt}
                  onChange={handlePromptEdit}
                  className="w-full min-h-[100px] p-2 text-sm border rounded"
                  placeholder="Edit your prompt here..."
                />
              </div>
              <div className="flex justify-center">
                <Button onClick={handleRegenerate} className="flex items-center space-x-2">
                  <Image className="h-4 w-4" />
                  <span>Generate Art</span>
                </Button>
              </div>
            </div>
          )}
          {generatedImage && !isGenerating && (
            <div className="space-y-4">
              <div className="relative">
                <img src={generatedImage} alt="Generated image" className="w-full rounded-lg" />
              </div>
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-sm font-medium">Current Prompt:</p>
                <p className="text-sm">{editablePrompt}</p>
              </div>
              <div className="flex justify-center">
                <Button onClick={handleRegenerate} className="flex items-center space-x-2">
                  <Redo className="h-4 w-4" />
                  <span>Regenerate</span>
                </Button>
              </div>
            </div>
          )}
          {isGenerating && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2">Generating image...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Add the default export
export default VoiceToImageGeneratorComponent