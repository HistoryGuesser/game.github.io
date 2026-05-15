import { supabase } from '../config/supabase.js';

const TABLE_NAME = 'leaderboard';

// Получить leaderboard
export async function getLeaderboard() {

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('score', { ascending: false });

  if (error) {
    console.error('Leaderboard load error:', error);
    return [];
  }

  return data || [];
}

// Сохранить результат
export async function saveScore(playerName, score) {

  const { error } = await supabase
    .from(TABLE_NAME)
    .insert([
      {
        name: playerName,
        score: score
      }
    ]);

  if (error) {
    console.error('Save score error:', error);
    return false;
  }

  return true;
}