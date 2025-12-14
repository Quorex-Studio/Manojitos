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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      credit_reminders: {
        Row: {
          channel: string
          created_at: string
          credit_id: string
          delivered: boolean | null
          delivery_status: string | null
          error_message: string | null
          id: string
          message: string
          notification_id: string | null
          reminder_type: string
          sent_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          credit_id: string
          delivered?: boolean | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          message: string
          notification_id?: string | null
          reminder_type: string
          sent_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          credit_id?: string
          delivered?: boolean | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          message?: string
          notification_id?: string | null
          reminder_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_reminders_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reminders_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          credit_id: string
          description: string | null
          id: string
          new_balance: number
          previous_balance: number
          sale_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_id: string
          description?: string | null
          id?: string
          new_balance: number
          previous_balance: number
          sale_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_id?: string
          description?: string | null
          id?: string
          new_balance?: number
          previous_balance?: number
          sale_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_user_id: string | null
          created_at: string
          credit_limit: number
          current_balance: number
          cut_off_day: number
          grace_days: number
          id: string
          is_blocked: boolean
          last_payment_date: string | null
          last_reminder_sent_at: string | null
          next_due_date: string | null
          notes: string | null
          reminders_sent: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_user_id?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          cut_off_day?: number
          grace_days?: number
          id?: string
          is_blocked?: boolean
          last_payment_date?: string | null
          last_reminder_sent_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          reminders_sent?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_user_id?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          cut_off_day?: number
          grace_days?: number
          id?: string
          is_blocked?: boolean
          last_payment_date?: string | null
          last_reminder_sent_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          reminders_sent?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount_bs: number | null
          amount_usd: number
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          sale_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_bs?: number | null
          amount_usd: number
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          id: string
          rate: number
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rate: number
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rate?: number
          source?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          credit_id: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          sent_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          credit_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          credit_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_usd: number
          sold_count: number
          stock: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_usd?: number
          sold_count?: number
          stock?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_usd?: number
          sold_count?: number
          stock?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_bs: number | null
          amount_usd: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          provider_id: string | null
          provider_name: string
          purchase_date: string
          status: string
          user_id: string
        }
        Insert: {
          amount_bs?: number | null
          amount_usd: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          provider_id?: string | null
          provider_name: string
          purchase_date?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          provider_id?: string | null
          provider_name?: string
          purchase_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          is_credit: boolean
          notes: string | null
          payment_method: string
          product_id: string | null
          product_name: string
          quantity: number
          total_bs: number | null
          total_usd: number
          unit_price_usd: number
          user_id: string
        }
        Insert: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          is_credit?: boolean
          notes?: string | null
          payment_method: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total_bs?: number | null
          total_usd: number
          unit_price_usd: number
          user_id: string
        }
        Update: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          is_credit?: boolean
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_bs?: number | null
          total_usd?: number
          unit_price_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_credit_status: {
        Args: {
          p_grace_days: number
          p_is_blocked: boolean
          p_next_due_date: string
        }
        Returns: string
      }
      get_unread_notifications_count: {
        Args: { p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
