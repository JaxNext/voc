import { describe, it, expect } from 'vitest'
import {
  RecordTypeSchema,
  LearningStatusSchema,
  GradeSchema,
  TagInputSchema,
  RecordInputSchema,
  ReviewGradeSchema,
} from '~/types/records'

const validUuid = '11111111-1111-4111-8111-111111111111'

describe('RecordTypeSchema', () => {
  it('accepts the three known record types', () => {
    expect(RecordTypeSchema.parse('word')).toBe('word')
    expect(RecordTypeSchema.parse('phrase')).toBe('phrase')
    expect(RecordTypeSchema.parse('sentence')).toBe('sentence')
  })

  it('rejects unknown values', () => {
    expect(() => RecordTypeSchema.parse('idiom')).toThrow(/Invalid option/)
    expect(() => RecordTypeSchema.parse('')).toThrow(/Invalid option/)
  })
})

describe('LearningStatusSchema', () => {
  it('accepts the three learning statuses', () => {
    expect(LearningStatusSchema.parse('new')).toBe('new')
    expect(LearningStatusSchema.parse('learning')).toBe('learning')
    expect(LearningStatusSchema.parse('mastered')).toBe('mastered')
  })

  it('rejects unknown values', () => {
    expect(() => LearningStatusSchema.parse('done')).toThrow(/Invalid option/)
  })
})

describe('GradeSchema', () => {
  it('accepts the four grades', () => {
    expect(GradeSchema.parse('forgot')).toBe('forgot')
    expect(GradeSchema.parse('hazy')).toBe('hazy')
    expect(GradeSchema.parse('know')).toBe('know')
    expect(GradeSchema.parse('easy')).toBe('easy')
  })

  it('rejects unknown values', () => {
    expect(() => GradeSchema.parse('maybe')).toThrow(/Invalid option/)
  })
})

describe('TagInputSchema', () => {
  it('accepts a non-empty name', () => {
    const parsed = TagInputSchema.parse({ name: 'travel' })
    expect(parsed.name).toBe('travel')
  })

  it('trims surrounding whitespace', () => {
    const parsed = TagInputSchema.parse({ name: '  work  ' })
    expect(parsed.name).toBe('work')
  })

  it('rejects an empty / whitespace-only name', () => {
    expect(() => TagInputSchema.parse({ name: '' })).toThrow(/Tag name is required/)
    expect(() => TagInputSchema.parse({ name: '   ' })).toThrow(/Tag name is required/)
  })

  it('rejects names longer than the max length', () => {
    expect(() => TagInputSchema.parse({ name: 'x'.repeat(51) })).toThrow(/at most 50 character/)
  })

  it('rejects missing name', () => {
    expect(() => TagInputSchema.parse({})).toThrow(/Invalid input/)
  })
})

describe('RecordInputSchema', () => {
  const baseValid = {
    type: 'word' as const,
    content: 'ephemeral',
    meaning: 'lasting for a very short time',
  }

  it('accepts a minimal record with no optional fields and no tags', () => {
    const parsed = RecordInputSchema.parse(baseValid)
    expect(parsed.tagIds).toEqual([])
    expect(parsed.source).toBeUndefined()
    expect(parsed.notes).toBeUndefined()
  })

  it('trims content and meaning', () => {
    const parsed = RecordInputSchema.parse({
      ...baseValid,
      content: '  ephemeral  ',
      meaning: '  short-lived  ',
    })
    expect(parsed.content).toBe('ephemeral')
    expect(parsed.meaning).toBe('short-lived')
  })

  it('accepts optional source, notes, and tagIds', () => {
    const parsed = RecordInputSchema.parse({
      ...baseValid,
      source: 'a novel',
      notes: 'used in formal writing',
      tagIds: [validUuid],
    })
    expect(parsed.source).toBe('a novel')
    expect(parsed.notes).toBe('used in formal writing')
    expect(parsed.tagIds).toEqual([validUuid])
  })

  it('rejects an invalid type', () => {
    expect(() => RecordInputSchema.parse({ ...baseValid, type: 'idiom' })).toThrow(/Invalid option/)
  })

  it('rejects empty content or meaning', () => {
    expect(() => RecordInputSchema.parse({ ...baseValid, content: '' })).toThrow(
      /Content is required/,
    )
    expect(() => RecordInputSchema.parse({ ...baseValid, meaning: '   ' })).toThrow(
      /Meaning is required/,
    )
  })

  it('rejects content/meaning longer than the max length', () => {
    expect(() => RecordInputSchema.parse({ ...baseValid, content: 'x'.repeat(501) })).toThrow(
      /at most 500 character/,
    )
    expect(() => RecordInputSchema.parse({ ...baseValid, meaning: 'x'.repeat(2001) })).toThrow(
      /at most 2000 character/,
    )
  })

  it('rejects non-UUID tag ids', () => {
    expect(() => RecordInputSchema.parse({ ...baseValid, tagIds: ['not-a-uuid'] })).toThrow(
      /Invalid UUID/,
    )
  })

  it('accepts an empty tagIds array explicitly', () => {
    const parsed = RecordInputSchema.parse({ ...baseValid, tagIds: [] })
    expect(parsed.tagIds).toEqual([])
  })
})

describe('ReviewGradeSchema', () => {
  it('accepts a record_id and a valid grade', () => {
    const parsed = ReviewGradeSchema.parse({ record_id: validUuid, grade: 'know' })
    expect(parsed.record_id).toBe(validUuid)
    expect(parsed.grade).toBe('know')
  })

  it('rejects a non-UUID record_id', () => {
    expect(() => ReviewGradeSchema.parse({ record_id: 'abc', grade: 'know' })).toThrow(
      /Invalid UUID/,
    )
  })

  it('rejects an invalid grade', () => {
    expect(() => ReviewGradeSchema.parse({ record_id: validUuid, grade: 'maybe' })).toThrow(
      /Invalid option/,
    )
  })

  it('rejects a missing grade', () => {
    expect(() => ReviewGradeSchema.parse({ record_id: validUuid })).toThrow(/Invalid option/)
  })

  it('rejects a missing record_id', () => {
    expect(() => ReviewGradeSchema.parse({ grade: 'know' })).toThrow(/Invalid input/)
  })
})
