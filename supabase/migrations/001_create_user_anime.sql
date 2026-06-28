CREATE TABLE user_anime (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mal_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('watching', 'completed', 'plan_to_watch', 'dropped')),
  episodes_watched INTEGER NOT NULL DEFAULT 0,
  total_episodes INTEGER,
  score REAL,
  added_at BIGINT NOT NULL,
  favorite BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, mal_id)
);

ALTER TABLE user_anime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own anime" ON user_anime
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_anime_user_id ON user_anime(user_id);
CREATE INDEX idx_user_anime_status ON user_anime(user_id, status);
