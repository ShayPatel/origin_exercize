import { useState, useEffect, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  prefillText?: string
  onPrefillConsumed?: () => void
}

export function ChatInput({ onSend, disabled, prefillText, onPrefillConsumed }: ChatInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (prefillText) {
      setValue(prefillText)
      onPrefillConsumed?.()
    }
  }, [prefillText, onPrefillConsumed])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 p-3 border-t border-[hsl(var(--border))]">
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about events…"
        disabled={disabled}
        className="flex-1 bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-sm"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        size="sm"
        className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
