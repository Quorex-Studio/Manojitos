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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      angela_alerts: {
        Row: {
          action_data: Json | null
          alert_type: string
          created_at: string
          expires_at: string | null
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          alert_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          alert_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      angela_conversations: {
        Row: {
          content: string
          context: Json | null
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_key: string
          rule_name: string
          rule_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_key: string
          rule_name: string
          rule_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_key?: string
          rule_name?: string
          rule_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          auto_limit_adjustment: boolean | null
          avg_payment_days: number | null
          blocked_at: string | null
          blocked_reason: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_user_id: string | null
          consecutive_late_payments: number | null
          created_at: string
          credit_limit: number
          current_balance: number
          cut_off_day: number
          early_payment_discount: number | null
          grace_days: number
          id: string
          is_blocked: boolean
          last_late_date: string | null
          last_payment_date: string | null
          last_reminder_sent_at: string | null
          next_due_date: string | null
          notes: string | null
          reminders_sent: Json | null
          restriction_level: number | null
          status: string
          total_paid_late: number | null
          total_paid_on_time: number | null
          total_purchases: number | null
          trust_level: string | null
          trust_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_limit_adjustment?: boolean | null
          avg_payment_days?: number | null
          blocked_at?: string | null
          blocked_reason?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_user_id?: string | null
          consecutive_late_payments?: number | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          cut_off_day?: number
          early_payment_discount?: number | null
          grace_days?: number
          id?: string
          is_blocked?: boolean
          last_late_date?: string | null
          last_payment_date?: string | null
          last_reminder_sent_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          reminders_sent?: Json | null
          restriction_level?: number | null
          status?: string
          total_paid_late?: number | null
          total_paid_on_time?: number | null
          total_purchases?: number | null
          trust_level?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_limit_adjustment?: boolean | null
          avg_payment_days?: number | null
          blocked_at?: string | null
          blocked_reason?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_user_id?: string | null
          consecutive_late_payments?: number | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          cut_off_day?: number
          early_payment_discount?: number | null
          grace_days?: number
          id?: string
          is_blocked?: boolean
          last_late_date?: string | null
          last_payment_date?: string | null
          last_reminder_sent_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          reminders_sent?: Json | null
          restriction_level?: number | null
          status?: string
          total_paid_late?: number | null
          total_paid_on_time?: number | null
          total_purchases?: number | null
          trust_level?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_memory: {
        Row: {
          created_at: string
          customer_phone: string | null
          customer_user_id: string | null
          expires_at: string | null
          id: string
          memory_key: string
          memory_type: string
          memory_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          expires_at?: string | null
          id?: string
          memory_key: string
          memory_type: string
          memory_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          expires_at?: string | null
          id?: string
          memory_key?: string
          memory_type?: string
          memory_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_payment_methods: {
        Row: {
          alias: string | null
          created_at: string
          details: Json | null
          id: string
          is_active: boolean | null
          is_preferred: boolean | null
          method_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alias?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          method_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alias?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          is_active?: boolean | null
          is_preferred?: boolean | null
          method_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          dni: string | null
          dni_photo_url: string | null
          email: string | null
          face_photo_url: string | null
          full_name: string | null
          id: string
          kyc_status: string
          location_coords: string | null
          notes: string | null
          notification_preferences: Json | null
          phone: string | null
          phone_verified: boolean | null
          state: string | null
          updated_at: string
          user_id: string
          verification_photo_url: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          dni?: string | null
          dni_photo_url?: string | null
          email?: string | null
          face_photo_url?: string | null
          full_name?: string | null
          id?: string
          kyc_status?: string
          location_coords?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          phone_verified?: boolean | null
          state?: string | null
          updated_at?: string
          user_id: string
          verification_photo_url?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          dni?: string | null
          dni_photo_url?: string | null
          email?: string | null
          face_photo_url?: string | null
          full_name?: string | null
          id?: string
          kyc_status?: string
          location_coords?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          phone_verified?: boolean | null
          state?: string | null
          updated_at?: string
          user_id?: string
          verification_photo_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      customer_timeline: {
        Row: {
          created_at: string
          customer_phone: string | null
          customer_user_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount_bs: number | null
          amount_usd: number
          client_address: string | null
          client_dni: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          sale_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_bs?: number | null
          amount_usd: number
          client_address?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number
          client_address?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string | null
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
          currency: string
          id: string
          rate: number
          source: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          rate: number
          source?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          rate?: number
          source?: string | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount_bs: number | null
          amount_usd: number
          balance_after_bs: number | null
          balance_after_usd: number
          created_at: string
          description: string | null
          entry_type: string
          id: string
          is_reversal: boolean | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string
          reversal_of_id: string | null
          reversed_by_id: string | null
          user_id: string
        }
        Insert: {
          amount_bs?: number | null
          amount_usd: number
          balance_after_bs?: number | null
          balance_after_usd: number
          created_at?: string
          description?: string | null
          entry_type: string
          id?: string
          is_reversal?: boolean | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type: string
          reversal_of_id?: string | null
          reversed_by_id?: string | null
          user_id: string
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number
          balance_after_bs?: number | null
          balance_after_usd?: number
          created_at?: string
          description?: string | null
          entry_type?: string
          id?: string
          is_reversal?: boolean | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string
          reversal_of_id?: string | null
          reversed_by_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reversed_by_id_fkey"
            columns: ["reversed_by_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
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
      orders: {
        Row: {
          banco_origen: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          delivery_fee: number
          discount: number
          id: string
          items: Json
          notes: string | null
          numero_referencia: string | null
          payment_method: string | null
          payment_status: string
          shipping_address: string | null
          shipping_city: string | null
          shipping_state: string | null
          status: string
          subtotal: number
          total_bs: number | null
          total_usd: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banco_origen?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          numero_referencia?: string | null
          payment_method?: string | null
          payment_status?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          status?: string
          subtotal?: number
          total_bs?: number | null
          total_usd: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banco_origen?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          numero_referencia?: string | null
          payment_method?: string | null
          payment_status?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          status?: string
          subtotal?: number
          total_bs?: number | null
          total_usd?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          id: string
          label: string
          method_key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          label: string
          method_key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          label?: string
          method_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_promises: {
        Row: {
          accepted_at: string | null
          actual_amount_paid: number | null
          actual_payment_date: string | null
          client_accepted: boolean | null
          created_at: string
          credit_id: string
          id: string
          notes: string | null
          promised_amount: number
          promised_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          actual_amount_paid?: number | null
          actual_payment_date?: string | null
          client_accepted?: boolean | null
          created_at?: string
          credit_id: string
          id?: string
          notes?: string | null
          promised_amount: number
          promised_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          actual_amount_paid?: number | null
          actual_payment_date?: string | null
          client_accepted?: boolean | null
          created_at?: string
          credit_id?: string
          id?: string
          notes?: string | null
          promised_amount?: number
          promised_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_promises_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          detail_kind: string
          id: string
          name: string
          options: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail_kind?: string
          id?: string
          name: string
          options?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail_kind?: string
          id?: string
          name?: string
          options?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          label: string
          price_usd: number | null
          product_id: string
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          price_usd?: number | null
          product_id: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          price_usd?: number | null
          product_id?: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_usd: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          minimum_stock: number | null
          name: string
          price_bs_usd: number | null
          price_retail_eur: number | null
          price_usd: number
          presentation: string | null
          price_wholesale_eur: number | null
          sizes: string[] | null
          sold_count: number
          stock: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          minimum_stock?: number | null
          name: string
          price_bs_usd?: number | null
          price_retail_eur?: number | null
          price_usd?: number
          presentation?: string | null
          price_wholesale_eur?: number | null
          sizes?: string[] | null
          sold_count?: number
          stock?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          minimum_stock?: number | null
          name?: string
          price_bs_usd?: number | null
          price_retail_eur?: number | null
          price_usd?: number
          presentation?: string | null
          price_wholesale_eur?: number | null
          sizes?: string[] | null
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
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sale_payments: {
        Row: {
          amount_bs: number | null
          amount_usd: number
          created_at: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          payment_method: string
          sale_group_id: string | null
          sale_id: string | null
          status: string
          usdt_bought: number | null
          usdt_rate: number | null
        }
        Insert: {
          amount_bs?: number | null
          amount_usd: number
          created_at?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_method: string
          sale_group_id?: string | null
          sale_id?: string | null
          status?: string
          usdt_bought?: number | null
          usdt_rate?: number | null
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number
          created_at?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_method?: string
          sale_group_id?: string | null
          sale_id?: string | null
          status?: string
          usdt_bought?: number | null
          usdt_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          amount_usd: number
          id: string
          product_id: string | null
          quantity: number
          return_id: string
          sale_id: string
        }
        Insert: {
          amount_usd: number
          id?: string
          product_id?: string | null
          quantity: number
          return_id: string
          sale_id: string
        }
        Update: {
          amount_usd?: number
          id?: string
          product_id?: string | null
          quantity?: number
          return_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          idempotency_key: string | null
          reason: string | null
          refund_due_usd: number
          return_type: string
          sale_group_id: string
          status: string
          total_usd: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          refund_due_usd?: number
          return_type: string
          sale_group_id: string
          status?: string
          total_usd?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          refund_due_usd?: number
          return_type?: string
          sale_group_id?: string
          status?: string
          total_usd?: number
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount_paid: number
          client_address: string | null
          client_dni: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          customer_user_id: string | null
          id: string
          is_credit: boolean
          notes: string | null
          payment_method: string
          payment_status: string
          product_id: string | null
          product_name: string
          quantity: number
          returned_at: string | null
          returned_quantity: number
          sale_group_id: string | null
          sale_modality: string
          status: string
          total_bs: number | null
          total_usd: number
          unit_price_usd: number
          user_id: string
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          amount_paid?: number
          client_address?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          is_credit?: boolean
          notes?: string | null
          payment_method: string
          payment_status?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          returned_at?: string | null
          returned_quantity?: number
          sale_group_id?: string | null
          sale_modality?: string
          status?: string
          total_bs?: number | null
          total_usd: number
          unit_price_usd: number
          user_id: string
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          amount_paid?: number
          client_address?: string | null
          client_dni?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          is_credit?: boolean
          notes?: string | null
          payment_method?: string
          payment_status?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          returned_at?: string | null
          returned_quantity?: number
          sale_group_id?: string | null
          sale_modality?: string
          status?: string
          total_bs?: number | null
          total_usd?: number
          unit_price_usd?: number
          user_id?: string
          variant_id?: string | null
          variant_label?: string | null
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
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
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
      angela_register_sale: {
        Args: {
          p_client_name?: string
          p_payment_method?: string
          p_product_name: string
          p_quantity: number
          p_total_usd?: number
          p_unit_price_usd?: number
        }
        Returns: Json
      }
      calculate_credit_status: {
        Args: {
          p_grace_days: number
          p_is_blocked: boolean
          p_next_due_date: string
        }
        Returns: string
      }
      calculate_trust_score: {
        Args: {
          p_consecutive_late: number
          p_current_score: number
          p_total_paid_late: number
          p_total_paid_on_time: number
          p_total_purchases: number
        }
        Returns: number
      }
      check_unique_customer_data: {
        Args: { p_dni: string; p_email: string; p_phone: string }
        Returns: Json
      }
      confirm_order: { Args: { p_order_id: string }; Returns: undefined }
      confirm_pos_sale: { Args: { p_sale_id: string }; Returns: Json }
      create_ledger_entry: {
        Args: {
          p_amount_bs: number
          p_amount_usd: number
          p_description: string
          p_entry_type: string
          p_metadata?: Json
          p_reference_id: string
          p_reference_type: string
          p_user_id: string
        }
        Returns: string
      }
      edit_group_abono: {
        Args: {
          p_abono_id: string
          p_amount_bs: number
          p_amount_usd: number
          p_exchange_rate: number
          p_notes: string
          p_payment_method: string
        }
        Returns: Json
      }
      edit_sale_total: {
        Args: { p_new_total_usd: number; p_notes: string; p_sale_id: string }
        Returns: Json
      }
      evaluate_business_rules: {
        Args: { p_admin_user_id: string; p_context: Json }
        Returns: Json
      }
      get_product_debtors: {
        Args: { p_product_id: string }
        Returns: {
          amount_paid: number
          client_name: string
          client_phone: string
          created_at: string
          pending_usd: number
          quantity: number
          sale_group_id: string
          sale_id: string
          sale_modality: string
          total_usd: number
        }[]
      }
      get_product_summary: {
        Args: {
          p_category?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          category: string
          cobrado: number
          pedidos: number
          pendiente: number
          por_cobrar: number
          product_id: string
          product_name: string
          total_bs: number
          total_usd: number
          vendido: number
          ventas: number
        }[]
      }
      get_restriction_level: {
        Args: { p_is_blocked: boolean; p_trust_level: string }
        Returns: number
      }
      get_trust_level: { Args: { p_score: number }; Returns: string }
      get_unread_notifications_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_ip_address?: string
          p_resource_id?: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      normalize_ve_phone: { Args: { p_phone: string }; Returns: string }
      process_checkout: {
        Args: {
          client_name: string
          client_phone: string
          items: Database["public"]["CompositeTypes"]["order_item_input"][]
          notes?: string
          p_banco_origen?: string
          p_delivery_fee?: number
          p_numero_referencia?: string
          payment_method: string
          total_bs_rate?: number
        }
        Returns: Json
      }
      process_group_abono: {
        Args: {
          p_amount_bs: number
          p_amount_usd: number
          p_exchange_rate: number
          p_notes: string
          p_payment_method: string
          p_sale_group_id: string
          p_usdt_bought: number
          p_usdt_rate: number
        }
        Returns: Json
      }
      process_pos_abono: {
        Args: {
          p_amount_bs: number
          p_amount_usd: number
          p_exchange_rate: number
          p_notes: string
          p_payment_method: string
          p_sale_id: string
          p_usdt_bought: number
          p_usdt_rate: number
        }
        Returns: Json
      }
      process_sale_return: {
        Args: {
          p_idempotency_key?: string
          p_items: Json
          p_reason?: string
          p_return_type: string
          p_sale_group_id: string
        }
        Returns: Json
      }
      recalculate_sale_group: {
        Args: { p_sale_group_id: string }
        Returns: undefined
      }
      reject_order: { Args: { p_order_id: string }; Returns: undefined }
      rpc_register_abono: {
        Args: {
          p_amount: number
          p_debt_id: string
          p_notes: string
          p_rate?: number
        }
        Returns: Json
      }
      rpc_register_credit_charge: {
        Args: {
          p_amount: number
          p_credit_id: string
          p_description: string
          p_sale_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      rpc_register_credit_payment: {
        Args: {
          p_amount: number
          p_credit_id: string
          p_description: string
          p_is_on_time: boolean
          p_user_id: string
        }
        Returns: Json
      }
      void_group_abono: { Args: { p_abono_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      order_item_input: {
        id: string | null
        name: string | null
        quantity: number | null
        price_usd: number | null
      }
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
    Enums: {},
  },
} as const
