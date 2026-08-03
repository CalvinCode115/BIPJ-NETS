export interface CheckinStatus {
  canCheckInToday: boolean;
  currentDay: number; // 1-7
  nextReward: number;
  schedule: number[]; // [1, 1, 3, 3, 5, 8, 10]
}

export interface CheckinResponse {
  success: boolean;
  day: number;
  reward: number;
}
