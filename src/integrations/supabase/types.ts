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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      academic_assignments: {
        Row: {
          created_at: string | null
          deadline: string | null
          description: string | null
          grade: number | null
          id: string
          observations: string | null
          project_id: string
          status: string
          subject_id: string
          title: string
          updated_at: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          grade?: number | null
          id?: string
          observations?: string | null
          project_id: string
          status?: string
          subject_id: string
          title: string
          updated_at?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          grade?: number | null
          id?: string
          observations?: string | null
          project_id?: string
          status?: string
          subject_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_classes: {
        Row: {
          content: string | null
          created_at: string | null
          date: string
          id: string
          materials_links: string[] | null
          observations: string | null
          subject_id: string
          summary: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          date?: string
          id?: string
          materials_links?: string[] | null
          observations?: string | null
          subject_id: string
          summary?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          date?: string
          id?: string
          materials_links?: string[] | null
          observations?: string | null
          subject_id?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_exams: {
        Row: {
          content: string | null
          created_at: string | null
          date: string
          exam_time: string | null
          grade: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["exam_status"] | null
          subject_id: string
          title: string
          updated_at: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          date: string
          exam_time?: string | null
          grade?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["exam_status"] | null
          subject_id: string
          title: string
          updated_at?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          date?: string
          exam_time?: string | null
          grade?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["exam_status"] | null
          subject_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_resources: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          project_id: string
          status: string | null
          subject_id: string | null
          title: string
          type: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          project_id: string
          status?: string | null
          subject_id?: string | null
          title: string
          type?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          project_id?: string
          status?: string | null
          subject_id?: string | null
          title?: string
          type?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_subjects: {
        Row: {
          absences_limit: number | null
          created_at: string | null
          current_absences: number | null
          description: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          period: string | null
          professor: string | null
          project_id: string
          schedule: string | null
          status: string | null
          syllabus: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          absences_limit?: number | null
          created_at?: string | null
          current_absences?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          period?: string | null
          professor?: string | null
          project_id: string
          schedule?: string | null
          status?: string | null
          syllabus?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          absences_limit?: number | null
          created_at?: string | null
          current_absences?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          period?: string | null
          professor?: string | null
          project_id?: string
          schedule?: string | null
          status?: string | null
          syllabus?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_subjects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_summaries: {
        Row: {
          content: string
          created_at: string | null
          id: string
          project_id: string
          subject_id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          subject_id: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          subject_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_summaries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_history: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          category: string | null
          city: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          next_contact: string | null
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          next_contact?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          next_contact?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          contact_id: string | null
          created_at: string | null
          decisions: string | null
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          objective: string | null
          post_meeting_notes: string | null
          pre_meeting_notes: string | null
          project_id: string | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          decisions?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          objective?: string | null
          post_meeting_notes?: string | null
          pre_meeting_notes?: string | null
          project_id?: string | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          decisions?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          objective?: string | null
          post_meeting_notes?: string | null
          pre_meeting_notes?: string | null
          project_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          contact_id: string | null
          created_at: string | null
          date: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          contact_id?: string | null
          created_at?: string | null
          date?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          contact_id?: string | null
          created_at?: string | null
          date?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["idea_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["idea_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["idea_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          project_id: string
          role_in_project: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          project_id: string
          role_in_project?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          project_id?: string
          role_in_project?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          project_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          category: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          next_action: string | null
          notes: string | null
          objective: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          type: Database["public"]["Enums"]["project_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget?: number | null
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          next_action?: string | null
          notes?: string | null
          objective?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          type?: Database["public"]["Enums"]["project_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget?: number | null
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          next_action?: string | null
          notes?: string | null
          objective?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          type?: Database["public"]["Enums"]["project_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          project_id: string | null
          responsible: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
          user_id: string
          waiting_for: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
          waiting_for?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          waiting_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      useful_links: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          project_id: string | null
          subject_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id?: string | null
          subject_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string | null
          subject_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "useful_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "useful_links_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      exam_status: "a_estudar" | "estudando" | "realizada" | "corrigida"
      idea_status:
        | "ideia"
        | "estudar"
        | "oportunidade"
        | "virou_projeto"
        | "arquivada"
      project_status:
        | "ideia"
        | "em_analise"
        | "planejamento"
        | "em_andamento"
        | "pausado"
        | "concluido"
      project_type:
        | "faculdade"
        | "imovel"
        | "consultoria"
        | "perfil_publico"
        | "novo_negocio"
        | "pessoal"
        | "generico"
      task_priority: "baixa" | "media" | "alta"
      task_status:
        | "a_fazer"
        | "em_andamento"
        | "aguardando_terceiro"
        | "concluido"
      transaction_status: "pendente" | "pago"
      transaction_type: "receita" | "despesa"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      exam_status: ["a_estudar", "estudando", "realizada", "corrigida"],
      idea_status: [
        "ideia",
        "estudar",
        "oportunidade",
        "virou_projeto",
        "arquivada",
      ],
      project_status: [
        "ideia",
        "em_analise",
        "planejamento",
        "em_andamento",
        "pausado",
        "concluido",
      ],
      project_type: [
        "faculdade",
        "imovel",
        "consultoria",
        "perfil_publico",
        "novo_negocio",
        "pessoal",
        "generico",
      ],
      task_priority: ["baixa", "media", "alta"],
      task_status: [
        "a_fazer",
        "em_andamento",
        "aguardando_terceiro",
        "concluido",
      ],
      transaction_status: ["pendente", "pago"],
      transaction_type: ["receita", "despesa"],
    },
  },
} as const
