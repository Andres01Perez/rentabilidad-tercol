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
      app_users: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          created_at: string
          created_by_id: string | null
          created_by_name: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string | null
          id: string
          negotiation_id: string
          precio_unitario: number
          referencia: string
          source_price_list_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion?: string | null
          id?: string
          negotiation_id: string
          precio_unitario: number
          referencia: string
          source_price_list_id?: string | null
          subtotal?: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          negotiation_id?: string
          precio_unitario?: number
          referencia?: string
          source_price_list_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_items_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          created_at: string
          created_by_id: string | null
          created_by_name: string
          id: string
          items_count: number
          name: string
          notes: string | null
          source_price_list_id: string | null
          total: number
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          id?: string
          items_count?: number
          name: string
          notes?: string | null
          source_price_list_id?: string | null
          total?: number
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          id?: string
          items_count?: number
          name?: string
          notes?: string | null
          source_price_list_id?: string | null
          total?: number
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Relationships: []
      }
      operational_costs: {
        Row: {
          cost_center_id: string
          created_at: string
          created_by_id: string | null
          created_by_name: string
          id: string
          percentage: number
          period_month: string
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
        }
        Insert: {
          cost_center_id: string
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          id?: string
          percentage: number
          period_month: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Update: {
          cost_center_id?: string
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          id?: string
          percentage?: number
          period_month?: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_costs_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_costs_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_costs_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          precio: number | null
          price_list_id: string
          referencia: string
          unidad_empaque: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          precio?: number | null
          price_list_id: string
          referencia: string
          unidad_empaque?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          precio?: number | null
          price_list_id?: string
          referencia?: string
          unidad_empaque?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by_id: string | null
          created_by_name: string
          id: string
          name: string
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          id?: string
          name: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_lists_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cant: number | null
          cifu: number | null
          created_at: string
          created_by_id: string | null
          created_by_name: string
          ct: number | null
          ctmat: number | null
          ctmo: number | null
          ctsit: number | null
          ctu: number | null
          cumat: number | null
          cumo: number | null
          cunago: number | null
          descripcion: string | null
          grupo: string | null
          id: string
          mou: number | null
          pct_cto: number | null
          pct_part: number | null
          period_month: string
          preciotot: number | null
          puv: number | null
          referencia: string
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
        }
        Insert: {
          cant?: number | null
          cifu?: number | null
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          ct?: number | null
          ctmat?: number | null
          ctmo?: number | null
          ctsit?: number | null
          ctu?: number | null
          cumat?: number | null
          cumo?: number | null
          cunago?: number | null
          descripcion?: string | null
          grupo?: string | null
          id?: string
          mou?: number | null
          pct_cto?: number | null
          pct_part?: number | null
          period_month: string
          preciotot?: number | null
          puv?: number | null
          referencia: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Update: {
          cant?: number | null
          cifu?: number | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          ct?: number | null
          ctmat?: number | null
          ctmo?: number | null
          ctsit?: number | null
          ctu?: number | null
          cumat?: number | null
          cumo?: number | null
          cunago?: number | null
          descripcion?: string | null
          grupo?: string | null
          id?: string
          mou?: number | null
          pct_cto?: number | null
          pct_part?: number | null
          period_month?: string
          preciotot?: number | null
          puv?: number | null
          referencia?: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cantidad: number
          created_at: string
          created_by_id: string | null
          created_by_name: string
          day: number
          dependencia: string | null
          id: string
          month: number
          precio_unitario: number | null
          referencia: string
          sale_date: string
          tercero: string | null
          valor_total: number
          vendedor: string | null
          year: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          created_by_id?: string | null
          created_by_name: string
          day: number
          dependencia?: string | null
          id?: string
          month: number
          precio_unitario?: number | null
          referencia: string
          sale_date: string
          tercero?: string | null
          valor_total: number
          vendedor?: string | null
          year: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string
          day?: number
          dependencia?: string | null
          id?: string
          month?: number
          precio_unitario?: number | null
          referencia?: string
          sale_date?: string
          tercero?: string | null
          valor_total?: number
          vendedor?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      master_references: {
        Row: {
          descripcion: string | null
          referencia: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
