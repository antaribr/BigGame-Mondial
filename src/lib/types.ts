export type Team = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type Member = {
  id: string;
  team_id: string;
  name: string;
  created_at: string;
};

export type Station = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  sort_order: number;
  created_at: string;
};

export type Completion = {
  id: string;
  team_id: string;
  station_id: string;
  score: number;
  created_at: string;
};

export type LeaderboardRow = {
  team_id: string;
  team_name: string;
  team_code: string;
  tasks_completed: number;
  total_points: number;
  rank: number;
};

export type Settings = {
  id: number;
  leaderboard_public: boolean;
};
