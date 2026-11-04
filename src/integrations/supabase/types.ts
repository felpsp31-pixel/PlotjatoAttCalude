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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      client_services: {
        Row: {
          cliente_id: string
          code: string
          description: string
          id: string
          unit_price: number
        }
        Insert: {
          cliente_id: string
          code: string
          description: string
          id?: string
          unit_price?: number
        }
        Update: {
          cliente_id?: string
          code?: string
          description?: string
          id?: string
          unit_price?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          cnpj?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      clientes_avulsos: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      demandas: {
        Row: {
          canal: string
          cliente_id: string | null
          cliente_nome: string
          concluido_at: string | null
          created_at: string
          descricao: string
          email: string
          id: string
          obra_id: string | null
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          retirado: boolean
          retirado_at: string | null
          servico: string
          solicitante_id: string | null
          status: string
          telefone: string
          tipo_saida: string | null
          valor_recibo: number | null
        }
        Insert: {
          canal?: string
          cliente_id?: string | null
          cliente_nome: string
          concluido_at?: string | null
          created_at?: string
          descricao?: string
          email?: string
          id?: string
          obra_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          retirado?: boolean
          retirado_at?: string | null
          servico?: string
          solicitante_id?: string | null
          status?: string
          telefone?: string
          tipo_saida?: string | null
          valor_recibo?: number | null
        }
        Update: {
          canal?: string
          cliente_id?: string | null
          cliente_nome?: string
          concluido_at?: string | null
          created_at?: string
          descricao?: string
          email?: string
          id?: string
          obra_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          retirado?: boolean
          retirado_at?: string | null
          servico?: string
          solicitante_id?: string | null
          status?: string
          telefone?: string
          tipo_saida?: string | null
          valor_recibo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "solicitantes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_info: {
        Row: {
          address: string
          cnpj: string
          email: string
          id: string
          logo: string
          name: string
          phone: string
        }
        Insert: {
          address?: string
          cnpj?: string
          email?: string
          id?: string
          logo?: string
          name?: string
          phone?: string
        }
        Update: {
          address?: string
          cnpj?: string
          email?: string
          id?: string
          logo?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      financial_invoices: {
        Row: {
          attachments: Json
          created_at: string
          description: string
          due_date: string
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          reference_month: string
          status: string
          value: number
        }
        Insert: {
          attachments?: Json
          created_at?: string
          description: string
          due_date: string
          entity_id: string
          entity_name: string
          entity_type?: string
          id?: string
          reference_month: string
          status?: string
          value?: number
        }
        Update: {
          attachments?: Json
          created_at?: string
          description?: string
          due_date?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          reference_month?: string
          status?: string
          value?: number
        }
        Relationships: []
      }
      monthly_recibo_summaries: {
        Row: {
          cliente_id: string
          cliente_name: string
          cnpj: string
          created_at: string
          id: string
          month: string
          processed: boolean
          total: number
        }
        Insert: {
          cliente_id: string
          cliente_name: string
          cnpj: string
          created_at?: string
          id?: string
          month: string
          processed?: boolean
          total?: number
        }
        Update: {
          cliente_id?: string
          cliente_name?: string
          cnpj?: string
          created_at?: string
          id?: string
          month?: string
          processed?: boolean
          total?: number
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          created_at: string
          id: string
          issqn_retido: number | null
          numero_nfse: string | null
          pdf_url: string | null
          tomador: string | null
          valor_liquido: number | null
          vencimento: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issqn_retido?: number | null
          numero_nfse?: string | null
          pdf_url?: string | null
          tomador?: string | null
          valor_liquido?: number | null
          vencimento?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issqn_retido?: number | null
          numero_nfse?: string | null
          pdf_url?: string | null
          tomador?: string | null
          valor_liquido?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      obras: {
        Row: {
          cliente_id: string
          delivery_value: number
          exemption_value: number
          has_delivery: boolean
          id: string
          name: string
        }
        Insert: {
          cliente_id: string
          delivery_value?: number
          exemption_value?: number
          has_delivery?: boolean
          id?: string
          name: string
        }
        Update: {
          cliente_id?: string
          delivery_value?: number
          exemption_value?: number
          has_delivery?: boolean
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      recibos: {
        Row: {
          cliente_avulso: string | null
          cliente_id: string | null
          created_at: string
          date: string
          id: string
          lines: Json
          number: string
          obra_id: string | null
          solicitante_id: string | null
          total: number
        }
        Insert: {
          cliente_avulso?: string | null
          cliente_id?: string | null
          created_at?: string
          date?: string
          id?: string
          lines?: Json
          number: string
          obra_id?: string | null
          solicitante_id?: string | null
          total?: number
        }
        Update: {
          cliente_avulso?: string | null
          cliente_id?: string | null
          created_at?: string
          date?: string
          id?: string
          lines?: Json
          number?: string
          obra_id?: string | null
          solicitante_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "recibos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "solicitantes"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          code: string
          description: string
          id: string
          unit_price: number
        }
        Insert: {
          code?: string
          description?: string
          id?: string
          unit_price?: number
        }
        Update: {
          code?: string
          description?: string
          id?: string
          unit_price?: number
        }
        Relationships: []
      }
      solicitantes: {
        Row: {
          cliente_id: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          cliente_id: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          cliente_id?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitantes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          retains_iss: boolean
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          retains_iss?: boolean
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          retains_iss?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_recibo_number: { Args: never; Returns: string }
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
