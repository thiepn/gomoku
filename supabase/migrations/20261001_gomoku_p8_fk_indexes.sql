-- P8 follow-up: cover tournament/season foreign keys used by lifecycle and account lookups.

create index if not exists gomoku_season_standings_user_idx
  on public.gomoku_season_standings (user_id);

create index if not exists gomoku_tournament_entries_user_idx
  on public.gomoku_tournament_entries (user_id);

create index if not exists gomoku_tournament_matches_player1_idx
  on public.gomoku_tournament_matches (player1_user_id)
  where player1_user_id is not null;

create index if not exists gomoku_tournament_matches_player2_idx
  on public.gomoku_tournament_matches (player2_user_id)
  where player2_user_id is not null;

create index if not exists gomoku_tournament_matches_winner_idx
  on public.gomoku_tournament_matches (winner_user_id)
  where winner_user_id is not null;

create index if not exists gomoku_tournaments_organizer_idx
  on public.gomoku_tournaments (organizer_user_id);

create index if not exists gomoku_tournaments_champion_idx
  on public.gomoku_tournaments (champion_user_id)
  where champion_user_id is not null;
