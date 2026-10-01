create index if not exists gomoku_social_presence_room_idx
  on public.gomoku_social_presence(room_id)
  where room_id is not null;

create index if not exists gomoku_direct_challenges_room_idx
  on public.gomoku_direct_challenges(room_id)
  where room_id is not null;
