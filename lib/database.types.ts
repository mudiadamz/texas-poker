export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      players: {
        Row: {
          all_in: boolean
          avatar_url: string | null
          bet_street: number
          chips: number
          folded: boolean
          hole_cards: Json | null
          id: string
          joined_at: string
          last_seen: string
          name: string
          room_id: string
          seat_number: number
          user_id: string | null
        }
        Insert: {
          all_in?: boolean
          avatar_url?: string | null
          bet_street?: number
          chips?: number
          folded?: boolean
          hole_cards?: Json | null
          id?: string
          joined_at?: string
          last_seen?: string
          name: string
          room_id: string
          // Trigger `players_assign_seat` fills this in to the lowest
          // unused slot, so callers can omit it.
          seat_number?: number
          user_id?: string | null
        }
        Update: {
          all_in?: boolean
          avatar_url?: string | null
          bet_street?: number
          chips?: number
          folded?: boolean
          hole_cards?: Json | null
          id?: string
          joined_at?: string
          last_seen?: string
          name?: string
          room_id?: string
          seat_number?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          chips: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chips?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chips?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          action_player_id: string | null
          action_timeout_seconds: number
          acts_remaining: number
          between_hand_seconds: number
          big_blind: number
          community_cards: Json
          created_at: string
          current_bet: number
          dealer_player_id: string | null
          deck_remaining: Json
          id: string
          last_raise: number
          name: string | null
          phase: string
          phase_ends_at: string | null
          pot: number
          reveal_seconds: number
          showdown_seconds: number
          small_blind: number
          starting_chips: number
          winners: Json | null
        }
        Insert: {
          action_player_id?: string | null
          action_timeout_seconds?: number
          acts_remaining?: number
          between_hand_seconds?: number
          big_blind?: number
          community_cards?: Json
          created_at?: string
          current_bet?: number
          dealer_player_id?: string | null
          deck_remaining?: Json
          id: string
          last_raise?: number
          name?: string | null
          phase?: string
          phase_ends_at?: string | null
          pot?: number
          reveal_seconds?: number
          showdown_seconds?: number
          small_blind?: number
          starting_chips?: number
          winners?: Json | null
        }
        Update: {
          action_player_id?: string | null
          action_timeout_seconds?: number
          acts_remaining?: number
          between_hand_seconds?: number
          big_blind?: number
          community_cards?: Json
          created_at?: string
          current_bet?: number
          dealer_player_id?: string | null
          deck_remaining?: Json
          id?: string
          last_raise?: number
          name?: string | null
          phase?: string
          phase_ends_at?: string | null
          pot?: number
          reveal_seconds?: number
          showdown_seconds?: number
          small_blind?: number
          starting_chips?: number
          winners?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      action_timeout: { Args: { p_room_id: string }; Returns: undefined }
      advance_action: { Args: { p_room_id: string }; Returns: undefined }
      advance_phase: { Args: { p_room_id: string }; Returns: undefined }
      apply_showdown_winners: {
        Args: { p_room_id: string; p_winners: Json }
        Returns: undefined
      }
      award_pot_to: {
        Args: { p_room_id: string; p_winner_id: string }
        Returns: undefined
      }
      betting_round_done: { Args: { p_room_id: string }; Returns: boolean }
      complete_betting_round: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      count_can_act: { Args: { p_room_id: string }; Returns: number }
      count_not_folded: { Args: { p_room_id: string }; Returns: number }
      deal_community: {
        Args: { p_count: number; p_room: Record<string, unknown> }
        Returns: Json
      }
      end_showdown: { Args: { p_room_id: string }; Returns: undefined }
      new_shuffled_deck: { Args: never; Returns: Json }
      next_action_player: {
        Args: { p_room_id: string; p_start: string }
        Returns: string
      }
      next_seat_player: {
        Args: { p_from_id: string; p_seats: string[]; p_skip_folded?: boolean }
        Returns: string
      }
      player_action: {
        Args: {
          p_action: string
          p_player_id: string
          p_raise_to?: number
          p_room_id: string
        }
        Returns: undefined
      }
      player_commit: {
        Args: { p_amount: number; p_player_id: string }
        Returns: number
      }
      reset_hand_state: { Args: { p_room_id: string }; Returns: undefined }
      room_seat_ids: { Args: { p_room_id: string }; Returns: string[] }
      seat_index: {
        Args: { p_player_id: string; p_seats: string[] }
        Returns: number
      }
      start_hand: { Args: { p_room_id: string }; Returns: undefined }
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
