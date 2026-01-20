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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      list_items: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          list_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      market_prices: {
        Row: {
          created_at: string
          id: string
          market_id: string
          price: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          price: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_prices_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      market_scores: {
        Row: {
          id: string
          market_id: string
          user_id: string
          score: number
          last_contribution_at: string
        }
        Insert: {
          id?: string
          market_id: string
          user_id: string
          score?: number
          last_contribution_at?: string
        }
        Update: {
          id?: string
          market_id?: string
          user_id?: string
          score?: number
          last_contribution_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_scores_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      markets: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          id: string
          market_id: string | null
          title: string
          description: string | null
          reward_points: number
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          market_id?: string | null
          title: string
          description?: string | null
          reward_points?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          market_id?: string | null
          title?: string
          description?: string | null
          reward_points?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          }
        ]
      }
      price_alerts: {
        Row: {
          id: string
          user_id: string
          market_id: string
          product_name: string
          price: number
          created_at: string
          upvotes: number
          is_verified: boolean
        }
        Insert: {
          id?: string
          user_id: string
          market_id: string
          product_name: string
          price: number
          created_at?: string
          upvotes?: number
          is_verified?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          market_id?: string
          product_name?: string
          price?: number
          created_at?: string
          upvotes?: number
          is_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          measurement: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          measurement?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          measurement?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          user_id: string
          market_id: string | null
          is_public: boolean
          forks_count: number
          original_list_id: string | null
          likes_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          user_id: string
          market_id?: string | null
          is_public?: boolean
          forks_count?: number
          original_list_id?: string | null
          likes_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          user_id?: string
          market_id?: string | null
          is_public?: boolean
          forks_count?: number
          original_list_id?: string | null
          likes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_original_list_id_fkey"
            columns: ["original_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_market_owner: {
        Args: {
          target_market_id: string
        }
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string
          score: number
        }[]
      }
      increment_forks: {
        Args: {
          target_list_id: string
        }
        Returns: void
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