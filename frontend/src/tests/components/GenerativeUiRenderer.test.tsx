import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GenerativeUiRenderer } from '@/components/agui/GenerativeUiRenderer'

const ticketResult = JSON.stringify({
  name: 'Test Event',
  event_date: '2026-12-01T10:00:00Z',
  registration_id: 'abc-123',
  user_id: 'bob',
})

const capacityResult = JSON.stringify({
  name: 'Test Event',
  old_capacity: 10,
  new_capacity: 20,
  current_registrations: 5,
})

describe('GenerativeUiRenderer', () => {
  it('renders AguiTicketWidget for register_user tool', () => {
    render(<GenerativeUiRenderer toolCallName="register_user" result={ticketResult} />)
    expect(screen.getByText('Confirmed Entry')).toBeInTheDocument()
  })

  it('renders AguiCapacityWidget for update_event_capacity tool', () => {
    render(<GenerativeUiRenderer toolCallName="update_event_capacity" result={capacityResult} />)
    expect(screen.getByText('System Scale Adjusted')).toBeInTheDocument()
  })

  it('renders nothing for unknown tool names', () => {
    const { container } = render(
      <GenerativeUiRenderer toolCallName="list_events" result="[]" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for get_event tool', () => {
    const { container } = render(
      <GenerativeUiRenderer toolCallName="get_event" result="{}" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders parse error fallback for invalid JSON', () => {
    render(<GenerativeUiRenderer toolCallName="register_user" result="not-json" />)
    expect(screen.getByText(/register_user/)).toBeInTheDocument()
  })
})
