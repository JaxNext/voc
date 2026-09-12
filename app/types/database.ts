// Supabase Database type — hand-written to match supabase/migrations/001_initial_schema.sql.
//
// This is the canonical shape expected by @nuxtjs/supabase's `useSupabaseClient<Database>()`
// and `serverSupabaseClient<Database>()` helpers (wired through `supabase.types` in
// nuxt.config.ts). When the project later has a live Supabase project, you can
// regenerate this file with `supabase gen types typescript --project-id <id>` and the
// shape will be a drop-in replacement.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type RecordType = 'word' | 'phrase' | 'sentence'
export type LearningStatus = 'new' | 'learning' | 'mastered'
export type Grade = 'forgot' | 'hazy' | 'know' | 'easy'

export type Database = {
  public: {
    Tables: {
      records: {
        Row: {
          id: string
          user_id: string
          type: RecordType
          content: string
          meaning: string
          source: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: RecordType
          content: string
          meaning: string
          source?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: RecordType
          content?: string
          meaning?: string
          source?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          user_id: string | null
          name: string
          is_predefined: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          is_predefined?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          is_predefined?: boolean
          created_at?: string
        }
        Relationships: []
      }
      record_tags: {
        Row: {
          record_id: string
          tag_id: string
        }
        Insert: {
          record_id: string
          tag_id: string
        }
        Update: {
          record_id?: string
          tag_id?: string
        }
        // FK constraint names follow Postgres's auto-naming for inline
        // REFERENCES (record_tags_record_id_fkey / record_tags_tag_id_fkey).
        // These let supabase-js resolve embeds like `record_tags(tags(*))`.
        Relationships: [
          {
            foreignKeyName: 'record_tags_record_id_fkey'
            columns: ['record_id']
            isOneToOne: false
            referencedRelation: 'records'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'record_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      review_states: {
        Row: {
          record_id: string
          status: LearningStatus
          interval_days: number
          consecutive_pass: number
          last_reviewed_at: string | null
          next_review_at: string
        }
        Insert: {
          record_id: string
          status?: LearningStatus
          interval_days?: number
          consecutive_pass?: number
          last_reviewed_at?: string | null
          next_review_at?: string
        }
        Update: {
          record_id?: string
          status?: LearningStatus
          interval_days?: number
          consecutive_pass?: number
          last_reviewed_at?: string | null
          next_review_at?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          id: string
          record_id: string
          user_id: string
          grade: Grade
          reviewed_at: string
        }
        Insert: {
          id?: string
          record_id: string
          user_id: string
          grade: Grade
          reviewed_at?: string
        }
        Update: {
          id?: string
          record_id?: string
          user_id?: string
          grade?: Grade
          reviewed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      record_type: RecordType
      learning_status: LearningStatus
      grade: Grade
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
