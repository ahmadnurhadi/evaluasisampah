export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          finding_id: string
          id: string
          is_demo: boolean
          notes: string | null
          photo_url: string | null
          pic_name: string | null
          status: Database["public"]["Enums"]["finding_status"]
          updated_at: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          finding_id: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          photo_url?: string | null
          pic_name?: string | null
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          finding_id?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          photo_url?: string | null
          pic_name?: string | null
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_date: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_demo: boolean
          location_id: string | null
          name: string
          organizer: string | null
          participant_count: number
          photo_url: string | null
          result: string | null
          updated_at: string
          waste_collected_kg: number
          waste_utilized_kg: number
        }
        Insert: {
          activity_date?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          name: string
          organizer?: string | null
          participant_count?: number
          photo_url?: string | null
          result?: string | null
          updated_at?: string
          waste_collected_kg?: number
          waste_utilized_kg?: number
        }
        Update: {
          activity_date?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          name?: string
          organizer?: string | null
          participant_count?: number
          photo_url?: string | null
          result?: string | null
          updated_at?: string
          waste_collected_kg?: number
          waste_utilized_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          name: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          name: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          name?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          audit_id: string | null
          category: string
          created_at: string
          deleted_at: string | null
          description: string
          due_date: string | null
          finding_code: string
          id: string
          is_demo: boolean
          location_id: string | null
          photo_url: string | null
          pic_id: string | null
          pic_name: string | null
          recommendation: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["finding_status"]
          updated_at: string
        }
        Insert: {
          audit_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          description: string
          due_date?: string | null
          finding_code?: string
          id?: string
          is_demo?: boolean
          location_id?: string | null
          photo_url?: string | null
          pic_id?: string | null
          pic_name?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Update: {
          audit_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          finding_code?: string
          id?: string
          is_demo?: boolean
          location_id?: string | null
          photo_url?: string | null
          pic_id?: string | null
          pic_name?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_indicators: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          max_score: number
          name: string
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          max_score?: number
          name: string
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          max_score?: number
          name?: string
          weight?: number
        }
        Relationships: []
      }
      audit_scores: {
        Row: {
          audit_id: string
          id: string
          indicator_id: string
          note: string | null
          score: number
        }
        Insert: {
          audit_id: string
          id?: string
          indicator_id: string
          note?: string | null
          score?: number
        }
        Update: {
          audit_id?: string
          id?: string
          indicator_id?: string
          note?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_scores_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_scores_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "audit_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audited_at: string
          auditor_id: string | null
          auditor_name: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          location_id: string | null
          notes: string | null
          photo_url: string | null
          school_id: string | null
          total_score: number
          updated_at: string
        }
        Insert: {
          audited_at?: string
          auditor_id?: string | null
          auditor_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          school_id?: string | null
          total_score?: number
          updated_at?: string
        }
        Update: {
          audited_at?: string
          auditor_id?: string | null
          auditor_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          school_id?: string | null
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_photos: {
        Row: {
          caption: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          code: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_demo: boolean
          name: string
          qr_token: string | null
          school_id: string
          type: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          qr_token?: string | null
          school_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          qr_token?: string | null
          school_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          type: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          type?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_demo: boolean
          phone: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_demo?: boolean
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_demo?: boolean
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      residual_disposals: {
        Row: {
          batch_id: string | null
          created_at: string
          deleted_at: string | null
          destination: string | null
          disposal_method: string | null
          disposed_at: string
          id: string
          is_demo: boolean
          notes: string | null
          photo_url: string | null
          transporter: string | null
          weight_kg: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          destination?: string | null
          disposal_method?: string | null
          disposed_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          photo_url?: string | null
          transporter?: string | null
          weight_kg: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          destination?: string | null
          disposal_method?: string | null
          disposed_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          photo_url?: string | null
          transporter?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "residual_disposals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          name: string
          npsn: string | null
          student_count: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          npsn?: string | null
          student_count?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          npsn?: string | null
          student_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_batches: {
        Row: {
          batch_code: string
          collected_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          generated_at: string
          id: string
          initial_weight_kg: number
          is_demo: boolean
          location_id: string | null
          notes: string | null
          school_id: string | null
          source_id: string | null
          stage: Database["public"]["Enums"]["batch_stage"]
          updated_at: string
        }
        Insert: {
          batch_code: string
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          generated_at?: string
          id?: string
          initial_weight_kg?: number
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          school_id?: string | null
          source_id?: string | null
          stage?: Database["public"]["Enums"]["batch_stage"]
          updated_at?: string
        }
        Update: {
          batch_code?: string
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          generated_at?: string
          id?: string
          initial_weight_kg?: number
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          school_id?: string | null
          source_id?: string | null
          stage?: Database["public"]["Enums"]["batch_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_batches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "waste_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_collections: {
        Row: {
          actual_weight_kg: number | null
          batch_id: string | null
          collected_at: string
          collector_id: string | null
          collector_name: string | null
          created_at: string
          deleted_at: string | null
          estimated_weight_kg: number | null
          id: string
          is_demo: boolean
          location_id: string | null
          notes: string | null
          photo_url: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["collection_status"]
          updated_at: string
        }
        Insert: {
          actual_weight_kg?: number | null
          batch_id?: string | null
          collected_at?: string
          collector_id?: string | null
          collector_name?: string | null
          created_at?: string
          deleted_at?: string | null
          estimated_weight_kg?: number | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Update: {
          actual_weight_kg?: number | null
          batch_id?: string | null
          collected_at?: string
          collector_id?: string | null
          collector_name?: string | null
          created_at?: string
          deleted_at?: string | null
          estimated_weight_kg?: number | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_collections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_collections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_collections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "waste_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_movements: {
        Row: {
          actor_id: string | null
          batch_id: string
          created_at: string
          description: string | null
          id: string
          occurred_at: string
          photo_url: string | null
          stage: Database["public"]["Enums"]["batch_stage"]
          weight_kg: number | null
        }
        Insert: {
          actor_id?: string | null
          batch_id: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          photo_url?: string | null
          stage: Database["public"]["Enums"]["batch_stage"]
          weight_kg?: number | null
        }
        Update: {
          actor_id?: string | null
          batch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          photo_url?: string | null
          stage?: Database["public"]["Enums"]["batch_stage"]
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_processing: {
        Row: {
          batch_id: string
          created_at: string
          deleted_at: string | null
          id: string
          input_weight_kg: number
          is_demo: boolean
          method: Database["public"]["Enums"]["processing_method"]
          notes: string | null
          output_weight_kg: number
          photo_url: string | null
          processed_at: string
          responsible_id: string | null
          responsible_name: string | null
          result: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          input_weight_kg: number
          is_demo?: boolean
          method: Database["public"]["Enums"]["processing_method"]
          notes?: string | null
          output_weight_kg?: number
          photo_url?: string | null
          processed_at?: string
          responsible_id?: string | null
          responsible_name?: string | null
          result?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          input_weight_kg?: number
          is_demo?: boolean
          method?: Database["public"]["Enums"]["processing_method"]
          notes?: string | null
          output_weight_kg?: number
          photo_url?: string | null
          processed_at?: string
          responsible_id?: string | null
          responsible_name?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_processing_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_records: {
        Row: {
          batch_id: string | null
          category: Database["public"]["Enums"]["waste_category"]
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          location_id: string | null
          notes: string | null
          photo_url: string | null
          recorded_at: string
          reporter_id: string | null
          school_id: string | null
          source_id: string | null
          unit: string
          updated_at: string
          waste_type_id: string | null
          weight_kg: number
        }
        Insert: {
          batch_id?: string | null
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          recorded_at?: string
          reporter_id?: string | null
          school_id?: string | null
          source_id?: string | null
          unit?: string
          updated_at?: string
          waste_type_id?: string | null
          weight_kg: number
        }
        Update: {
          batch_id?: string | null
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location_id?: string | null
          notes?: string | null
          photo_url?: string | null
          recorded_at?: string
          reporter_id?: string | null
          school_id?: string | null
          source_id?: string | null
          unit?: string
          updated_at?: string
          waste_type_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "waste_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_sales: {
        Row: {
          batch_id: string | null
          category: Database["public"]["Enums"]["waste_category"]
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          notes: string | null
          partner_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price_per_kg: number
          sold_at: string
          total_value: number | null
          transaction_code: string
          waste_type_id: string | null
          weight_kg: number
        }
        Insert: {
          batch_id?: string | null
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          partner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_per_kg?: number
          sold_at?: string
          total_value?: number | null
          transaction_code?: string
          waste_type_id?: string | null
          weight_kg: number
        }
        Update: {
          batch_id?: string | null
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          partner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_per_kg?: number
          sold_at?: string
          total_value?: number | null
          transaction_code?: string
          waste_type_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_sales_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_sales_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_sorting: {
        Row: {
          batch_id: string
          category: Database["public"]["Enums"]["waste_category"]
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          notes: string | null
          sorted_at: string
          sorted_by: string | null
          waste_type_id: string | null
          weight_kg: number
        }
        Insert: {
          batch_id: string
          category: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          sorted_at?: string
          sorted_by?: string | null
          waste_type_id?: string | null
          weight_kg: number
        }
        Update: {
          batch_id?: string
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          sorted_at?: string
          sorted_by?: string | null
          waste_type_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_sorting_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_sorting_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_sources: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      waste_types: {
        Row: {
          category: Database["public"]["Enums"]["waste_category"]
          created_at: string
          default_price_per_kg: number
          deleted_at: string | null
          id: string
          is_demo: boolean
          name: string
          recyclable: boolean
        }
        Insert: {
          category: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          default_price_per_kg?: number
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          recyclable?: boolean
        }
        Update: {
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          default_price_per_kg?: number
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          recyclable?: boolean
        }
        Relationships: []
      }
      waste_utilization: {
        Row: {
          batch_id: string | null
          created_at: string
          deleted_at: string | null
          destination: string | null
          economic_value: number
          id: string
          is_demo: boolean
          notes: string | null
          partner_id: string | null
          photo_url: string | null
          used_at: string
          utilization_type: string
          weight_kg: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          destination?: string | null
          economic_value?: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          partner_id?: string | null
          photo_url?: string | null
          used_at?: string
          utilization_type: string
          weight_kg: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          destination?: string | null
          economic_value?: number
          id?: string
          is_demo?: boolean
          notes?: string | null
          partner_id?: string | null
          photo_url?: string | null
          used_at?: string
          utilization_type?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_utilization_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "waste_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_utilization_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_record: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      next_batch_code: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "coordinator"
        | "teacher"
        | "cleaning_staff"
        | "student"
        | "principal"
      batch_stage:
        | "generated"
        | "collected"
        | "weighed"
        | "sorted"
        | "processed"
        | "utilized"
        | "sold"
        | "recycled"
        | "disposed"
      collection_status: "pending" | "in_progress" | "collected" | "cancelled"
      finding_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "verified"
        | "closed"
      payment_status: "unpaid" | "partial" | "paid"
      processing_method:
        | "composting"
        | "recycling"
        | "reuse"
        | "upcycling"
        | "eco_enzyme"
        | "waste_bank"
        | "other"
      severity_level: "low" | "medium" | "high" | "critical"
      waste_category:
        | "organic"
        | "plastic"
        | "paper"
        | "cardboard"
        | "metal"
        | "glass"
        | "b3"
        | "residual"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "school_admin",
        "coordinator",
        "teacher",
        "cleaning_staff",
        "student",
        "principal",
      ],
      batch_stage: [
        "generated",
        "collected",
        "weighed",
        "sorted",
        "processed",
        "utilized",
        "sold",
        "recycled",
        "disposed",
      ],
      collection_status: ["pending", "in_progress", "collected", "cancelled"],
      finding_status: ["open", "in_progress", "resolved", "verified", "closed"],
      payment_status: ["unpaid", "partial", "paid"],
      processing_method: [
        "composting",
        "recycling",
        "reuse",
        "upcycling",
        "eco_enzyme",
        "waste_bank",
        "other",
      ],
      severity_level: ["low", "medium", "high", "critical"],
      waste_category: [
        "organic",
        "plastic",
        "paper",
        "cardboard",
        "metal",
        "glass",
        "b3",
        "residual",
        "other",
      ],
    },
  },
} as const
