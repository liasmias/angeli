// Hand-written to match supabase/migrations/0001_init.sql.
// If the schema drifts, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type PlayerFlag = "yellow" | "red";

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type ProfileRole = "user" | "admin";

export interface StatFields {
  minutes: number;
  goals: number;
  assists: number;
  goals_conceded: number;
  saves: number;
  penalties_saved: number;
  penalties_conceded: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
}

export type NullableStatFields = {
  [K in keyof StatFields]: StatFields[K] | null;
};

// Row types are declared standalone (not looked up via `Database["public"]["Tables"][...]`)
// on purpose: self-referential lookups inside the same interface push supabase-js's
// generic select-query-parser past its type-instantiation depth, which makes every
// `.select()` silently collapse to `never` instead of raising a type error.
type LeagueSettingsRow = {
  id: number;
  season: string;
  budget_cap: number;
  squad_size: number;
  starting_size: number;
  free_transfers_per_gameweek: number;
  extra_transfer_cost: number;
  max_banked_transfers: number;
  gk_slots: number;
  def_slots: number;
  mid_slots: number;
  fwd_slots: number;
  last_sync_at: string | null;
  last_sync_note: string | null;
  announcement: string | null;
};

type ReportsRow = {
  id: number;
  user_id: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

type ClubsRow = {
  id: number;
  name: string;
  short_name: string | null;
  api_football_team_id: number | null;
};

type PlayersRow = {
  id: number;
  first_name: string | null;
  last_name: string;
  club_id: number | null;
  position: Position;
  price: number;
  api_football_player_id: number | null;
  is_active: boolean;
  /** Verfügbarkeit: null | "yellow" (fraglich) | "red" (fällt aus). */
  flag: PlayerFlag | null;
  flag_note: string | null;
};

type GameweeksRow = {
  id: number;
  season: string;
  number: number;
  deadline: string;
  is_locked: boolean;
};

type FixturesRow = {
  id: number;
  gameweek_id: number | null;
  home_club_id: number | null;
  away_club_id: number | null;
  kickoff: string | null;
  api_football_fixture_id: number | null;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
};

type ProfilesRow = {
  id: string;
  username: string;
  role: ProfileRole;
  created_at: string;
  is_blocked: boolean;
};

// Flattened into a single object type rather than `{...} & StatFields`: that
// intersection form makes supabase-js's generic select-query-parser blow past
// its type-instantiation budget once enough other tables are in the schema,
// which silently turns every `.select()` result (on any table) into `never`.
type PlayerStatsRow = {
  id: number;
  player_id: number;
  gameweek_id: number;
  fixture_id: number | null;
  synced_at: string;
  /** Bewertung von API-Football (ca. 6.0-10.0); zaehlt nicht fuer die Punkte. */
  rating: number | null;
  minutes: number;
  goals: number;
  assists: number;
  goals_conceded: number;
  saves: number;
  penalties_saved: number;
  penalties_conceded: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
};

type PlayerStatsOverridesRow = {
  id: number;
  player_id: number;
  gameweek_id: number;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  goals_conceded: number | null;
  saves: number | null;
  penalties_saved: number | null;
  penalties_conceded: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  own_goals: number | null;
};

type FantasyPointsRow = {
  id: number;
  player_id: number;
  gameweek_id: number;
  points: number;
  breakdown: Record<string, number> | null;
  computed_at: string;
};

type SquadsRow = {
  id: number;
  user_id: string;
  free_transfers_remaining: number;
  created_at: string;
};

type SquadPlayersRow = {
  squad_id: number;
  player_id: number;
  is_starting: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  purchase_price: number;
  bench_order: number;
};

type GameweekSquadsRow = {
  id: number;
  squad_id: number;
  gameweek_id: number;
  player_id: number;
  is_starting: boolean;
  is_captain: boolean;
  points_earned: number | null;
  bench_order: number;
  auto_subbed: boolean;
  is_vice_captain: boolean;
};

type TransfersRow = {
  id: number;
  squad_id: number;
  gameweek_id: number;
  player_out_id: number | null;
  player_in_id: number | null;
  points_cost: number;
  created_at: string;
};

export type ChipName = "wildcard" | "bench_boost";

type ChipUsagesRow = {
  id: number;
  squad_id: number;
  chip: ChipName;
  gameweek_id: number;
  activated_at: string;
};

type PointAdjustmentsRow = {
  id: number;
  squad_id: number;
  points: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

type PriceChangesRow = {
  id: number;
  player_id: number;
  gameweek_id: number;
  delta: number;
  created_at: string;
};

type StandingsRow = {
  user_id: string;
  username: string;
  total_points: number;
};

export interface Database {
  public: {
    Tables: {
      league_settings: {
        Row: LeagueSettingsRow;
        Insert: Partial<LeagueSettingsRow>;
        Update: Partial<LeagueSettingsRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportsRow;
        Insert: Omit<ReportsRow, "id" | "created_at" | "resolved_at"> & {
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<ReportsRow>;
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: ClubsRow;
        Insert: Omit<ClubsRow, "id"> & { id?: number };
        Update: Partial<ClubsRow>;
        Relationships: [];
      };
      players: {
        Row: PlayersRow;
        Insert: Omit<PlayersRow, "id"> & { id?: number };
        Update: Partial<PlayersRow>;
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      gameweeks: {
        Row: GameweeksRow;
        Insert: Omit<GameweeksRow, "id"> & { id?: number };
        Update: Partial<GameweeksRow>;
        Relationships: [];
      };
      fixtures: {
        Row: FixturesRow;
        Insert: Omit<FixturesRow, "id"> & { id?: number };
        Update: Partial<FixturesRow>;
        Relationships: [
          {
            foreignKeyName: "fixtures_home_club_id_fkey";
            columns: ["home_club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_away_club_id_fkey";
            columns: ["away_club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: ProfilesRow;
        Insert: ProfilesRow;
        Update: Partial<ProfilesRow>;
        Relationships: [];
      };
      player_stats: {
        Row: PlayerStatsRow;
        // `synced_at` optional statt ausgeschlossen: Beim Upsert muss der
        // Zeitstempel explizit mitgegeben werden, weil der Standardwert
        // `now()` nur beim Einfügen greift.
        Insert: Omit<PlayerStatsRow, "id" | "synced_at"> & {
          id?: number;
          synced_at?: string;
        };
        Update: Partial<PlayerStatsRow>;
        Relationships: [
          {
            foreignKeyName: "player_stats_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      player_stats_overrides: {
        Row: PlayerStatsOverridesRow;
        Insert: Omit<PlayerStatsOverridesRow, "id"> & { id?: number; updated_at?: string };
        Update: Partial<PlayerStatsOverridesRow>;
        Relationships: [];
      };
      fantasy_points: {
        Row: FantasyPointsRow;
        Insert: Omit<FantasyPointsRow, "id"> & { id?: number; computed_at?: string };
        Update: Partial<FantasyPointsRow>;
        Relationships: [];
      };
      squads: {
        Row: SquadsRow;
        Insert: Omit<SquadsRow, "id" | "created_at"> & { id?: number };
        Update: Partial<SquadsRow>;
        Relationships: [];
      };
      squad_players: {
        Row: SquadPlayersRow;
        Insert: Omit<SquadPlayersRow, "bench_order"> & { bench_order?: number };
        Update: Partial<SquadPlayersRow>;
        Relationships: [];
      };
      gameweek_squads: {
        Row: GameweekSquadsRow;
        Insert: Omit<GameweekSquadsRow, "id" | "bench_order" | "auto_subbed" | "is_vice_captain"> & {
          id?: number;
          bench_order?: number;
          auto_subbed?: boolean;
          is_vice_captain?: boolean;
        };
        Update: Partial<GameweekSquadsRow>;
        Relationships: [];
      };
      transfers: {
        Row: TransfersRow;
        Insert: Omit<TransfersRow, "id" | "created_at"> & { id?: number };
        Update: Partial<TransfersRow>;
        Relationships: [];
      };
      point_adjustments: {
        Row: PointAdjustmentsRow;
        Insert: Omit<PointAdjustmentsRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<PointAdjustmentsRow>;
        Relationships: [];
      };
      chip_usages: {
        Row: ChipUsagesRow;
        Insert: Omit<ChipUsagesRow, "id" | "activated_at"> & {
          id?: number;
          activated_at?: string;
        };
        Update: Partial<ChipUsagesRow>;
        Relationships: [];
      };
      price_changes: {
        Row: PriceChangesRow;
        Insert: Omit<PriceChangesRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<PriceChangesRow>;
        Relationships: [];
      };
    };
    Views: {
      standings: {
        Row: StandingsRow;
        Relationships: [];
      };
    };
    Functions: {
      update_username: {
        Args: { p_username: string };
        Returns: void;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}
