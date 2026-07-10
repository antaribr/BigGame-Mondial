import { supabase } from "./supabase";
import type { Team } from "./types";

export type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
};

export type QuizAttempt = {
  id: string;
  team_id: string;
  station_id: string;
  score: number;
  questions_answered: number;
  correct_answers: number;
  started_at: string;
  completed_at: string | null;
};

export type QuizAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: string | null;
  is_correct: boolean;
};

/**
 * Fetch all teams for team selection
 */
export async function fetchTeams(): Promise<Team[]> {
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []) as Team[];
}

/**
 * Fetch questions for the quiz (shuffled)
 */
export async function fetchQuestions(count = 20): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .limit(count);
  
  if (!data || data.length === 0) return [];
  
  // Shuffle questions
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled as Question[];
}

/**
 * Check if team has already attempted this station's quiz
 */
export async function checkQuizAttempt(
  teamId: string,
  stationId: string
): Promise<QuizAttempt | null> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("team_id", teamId)
    .eq("station_id", stationId)
    .maybeSingle();
  return data as QuizAttempt | null;
}

/**
 * Start a new quiz attempt
 */
export async function startQuizAttempt(
  teamId: string,
  stationId: string
): Promise<QuizAttempt | null> {
  // Check if already attempted
  const existing = await checkQuizAttempt(teamId, stationId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      team_id: teamId,
      station_id: stationId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error starting quiz:", error);
    return null;
  }
  return data as QuizAttempt;
}

/**
 * Submit quiz answers and calculate score
 */
export async function submitQuizAnswers(
  attemptId: string,
  answers: { question_id: string; selected_option: string | null }[]
): Promise<{ score: number; correct_answers: number; questions_answered: number }> {
  // Fetch all questions to check correct answers
  const questionIds = answers.map((a) => a.question_id);
  const { data: questions } = await supabase
    .from("questions")
    .select("id, correct_option")
    .in("id", questionIds);

  if (!questions) {
    return { score: 0, correct_answers: 0, questions_answered: 0 };
  }

  const questionMap = new Map(questions.map((q) => [q.id, q.correct_option]));
  let correctCount = 0;
  const answersToInsert: Partial<QuizAnswer>[] = [];

  for (const answer of answers) {
    const correctOption = questionMap.get(answer.question_id);
    const isCorrect = answer.selected_option === correctOption;
    if (isCorrect) correctCount++;

    answersToInsert.push({
      attempt_id: attemptId,
      question_id: answer.question_id,
      selected_option: answer.selected_option,
      is_correct: isCorrect,
    });
  }

  // Insert all answers
  if (answersToInsert.length > 0) {
    await supabase.from("quiz_answers").insert(answersToInsert);
  }

  // Calculate score (0.5 per correct answer)
  const score = correctCount * 0.5;

  // Update the attempt
  await supabase
    .from("quiz_attempts")
    .update({
      score,
      correct_answers: correctCount,
      questions_answered: answers.length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  return {
    score,
    correct_answers: correctCount,
    questions_answered: answers.length,
  };
}

/**
 * Award points to team via station completion
 */
export async function awardQuizPoints(
  teamId: string,
  stationCode: string,
  score: number
): Promise<void> {
  // Use the existing complete_task RPC
  const { error } = await supabase.rpc("complete_task", {
    p_station_code: stationCode,
    p_team_id: teamId,
    p_score: score,
  });

  if (error) {
    console.error("Error awarding quiz points:", error);
    throw error;
  }
}
