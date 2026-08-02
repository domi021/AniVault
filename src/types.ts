export interface Anime {
  mal_id: number;
  title: string;
  title_english?: string;
  synopsis?: string;
  image_url?: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  episodes?: number;
  status?: string;
  score?: number;
  genres?: { mal_id: number; name: string }[];
  studios?: { mal_id: number; name: string }[];
  type?: string;
  aired?: { from?: string; to?: string };
}

export interface Pagination {
  last_visible_page: number;
  has_next_page: boolean;
}

export interface SearchResponse {
  data: Anime[];
  pagination: Pagination;
}

export interface Recommendation {
  entry: Anime;
  url: string;
  votes: number;
}

export interface RecommendationsResponse {
  data: Recommendation[];
}

export type WatchStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

export interface UserAnime {
  mal_id: number;
  title: string;
  image_url: string;
  status: WatchStatus;
  episodes_watched: number;
  total_episodes?: number;
  score?: number;
  added_at: number;
  favorite?: boolean;
}
