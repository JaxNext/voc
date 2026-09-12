// Shared Zod schemas for record/tag/grade input validation.
//
// Used at the API boundary (Nitro routes) and on the client (form validation
// in RecordForm/TagPicker) to keep a single source of truth for shape and
// constraints. Inferred TypeScript types are re-exported for use across the app.

import { z } from 'zod'

// ----- Constants ---------------------------------------------------------

// Matches the `record_type` enum in 001_initial_schema.sql.
export const RecordTypeSchema = z.enum(['word', 'phrase', 'sentence'])
export const RECORD_TYPES = RecordTypeSchema.enum

// Matches the `learning_status` enum.
export const LearningStatusSchema = z.enum(['new', 'learning', 'mastered'])

// Matches the `grade` enum — also reused as the body schema for
// POST /api/review/grade.
export const GradeSchema = z.enum(['forgot', 'hazy', 'know', 'easy'])
export const REVIEW_GRADES = GradeSchema.enum

// Soft limits — keep generous; Supabase text columns are unbounded but
// real-world vocabulary entries are short. Exported: UI inputs reuse them as
// maxlength attributes (RecordForm) and TagPicker uses MAX_TAG_NAME.
export const MAX_CONTENT = 500
export const MAX_MEANING = 2000
export const MAX_SOURCE = 500
export const MAX_NOTES = 4000
export const MAX_TAG_NAME = 50

// ----- Tag ---------------------------------------------------------------

// TagInputSchema is the payload accepted by the tag-create flow. `name` is
// trimmed and length-bounded; `is_predefined` is not accepted from the client
// — only the database seed (and a future admin tool) may set it true.
export const TagInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag name is required')
    .max(MAX_TAG_NAME, `Tag name must be at most ${MAX_TAG_NAME} characters`),
})

// ----- Record ------------------------------------------------------------

// UUID helper — used for record_id, tag_id, etc.
const UuidSchema = z.uuid()

// RecordInputSchema is the payload for create / update of a record. The
// `tagIds` array is required (empty array means "no tags") so the form layer
// always sends a complete intent.
export const RecordInputSchema = z.object({
  type: RecordTypeSchema,
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(MAX_CONTENT, `Content must be at most ${MAX_CONTENT} characters`),
  meaning: z
    .string()
    .trim()
    .min(1, 'Meaning is required')
    .max(MAX_MEANING, `Meaning must be at most ${MAX_MEANING} characters`),
  source: z
    .string()
    .trim()
    .max(MAX_SOURCE, `Source must be at most ${MAX_SOURCE} characters`)
    .optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES, `Notes must be at most ${MAX_NOTES} characters`)
    .optional(),
  tagIds: z.array(UuidSchema).default([]),
})

// ----- Review grade ------------------------------------------------------

// ReviewGradeSchema is the body of POST /api/review/grade.
export const ReviewGradeSchema = z.object({
  record_id: UuidSchema,
  grade: GradeSchema,
})

// ----- Inferred types ----------------------------------------------------

export type RecordType = z.infer<typeof RecordTypeSchema>
export type LearningStatus = z.infer<typeof LearningStatusSchema>
export type Grade = z.infer<typeof GradeSchema>
export type TagInput = z.infer<typeof TagInputSchema>
export type RecordInput = z.infer<typeof RecordInputSchema>
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>
