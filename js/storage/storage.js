export const SAVE_KEY = 'historyguesser_save';
export const LEADERBOARD_KEY = 'historyguesser_leaderboard_v1';
export const PLAYER_KEY = 'historyguesser_player_profile_v1';

export function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function removeJSON(key) {
  localStorage.removeItem(key);
}