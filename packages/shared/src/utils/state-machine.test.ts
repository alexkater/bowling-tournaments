import { describe, it, expect } from 'vitest'
import { transition, getValidTransitions } from './state-machine'

describe('tournament state machine', () => {
  it('allows draft → published', () => {
    expect(transition('tournament', 'draft', 'published')).toBe('published')
  })

  it('allows draft → cancelled', () => {
    expect(transition('tournament', 'draft', 'cancelled')).toBe('cancelled')
  })

  it('allows published → in_progress', () => {
    expect(transition('tournament', 'published', 'in_progress')).toBe('in_progress')
  })

  it('allows published → cancelled', () => {
    expect(transition('tournament', 'published', 'cancelled')).toBe('cancelled')
  })

  it('allows in_progress → completed', () => {
    expect(transition('tournament', 'in_progress', 'completed')).toBe('completed')
  })

  it('allows in_progress → cancelled', () => {
    expect(transition('tournament', 'in_progress', 'cancelled')).toBe('cancelled')
  })

  it('blocks cancelled → any state', () => {
    for (const target of ['draft', 'published', 'in_progress', 'completed', 'cancelled'] as const) {
      expect(() => transition('tournament', 'cancelled', target)).toThrow('Invalid transition')
    }
  })

  it('blocks completed → any state', () => {
    for (const target of ['draft', 'published', 'in_progress', 'completed', 'cancelled'] as const) {
      expect(() => transition('tournament', 'completed', target)).toThrow('Invalid transition')
    }
  })

  it('blocks published → draft (cannot go back)', () => {
    expect(() => transition('tournament', 'published', 'draft')).toThrow('Invalid transition')
  })

  it('blocks in_progress → published (cannot go back)', () => {
    expect(() => transition('tournament', 'in_progress', 'published')).toThrow('Invalid transition')
  })

  it('blocks draft → completed (cannot skip published)', () => {
    expect(() => transition('tournament', 'draft', 'completed')).toThrow('Invalid transition')
  })

  it('returns valid transitions for draft', () => {
    expect(getValidTransitions('tournament', 'draft')).toEqual(['published', 'cancelled'])
  })

  it('returns valid transitions for completed', () => {
    expect(getValidTransitions('tournament', 'completed')).toEqual([])
  })
})

describe('bracket state machine', () => {
  it('allows open → shuffling', () => {
    expect(transition('bracket', 'open', 'shuffling')).toBe('shuffling')
  })

  it('allows shuffling → in_progress', () => {
    expect(transition('bracket', 'shuffling', 'in_progress')).toBe('in_progress')
  })

  it('allows in_progress → completed', () => {
    expect(transition('bracket', 'in_progress', 'completed')).toBe('completed')
  })

  it('blocks completed → any state', () => {
    expect(() => transition('bracket', 'completed', 'in_progress')).toThrow('Invalid transition')
  })

  it('blocks open → in_progress (must shuffle first)', () => {
    expect(() => transition('bracket', 'open', 'in_progress')).toThrow('Invalid transition')
  })

  it('returns valid transitions for open', () => {
    expect(getValidTransitions('bracket', 'open')).toEqual(['shuffling', 'cancelled'])
  })
})
