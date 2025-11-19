/**
 * Fuzzy matching utilities for student name matching
 * Uses Levenshtein distance algorithm
 */

export interface Student {
  id: number;
  name: string;
  nickname: string | null;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one word into the other.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Levenshtein distance
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Deletion
        matrix[i][j - 1] + 1, // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Match result with confidence score
 */
export interface MatchResult {
  student: Student | null;
  confidence: number;
  matchType: 'exact' | 'nickname' | 'fuzzy' | 'none';
  distance?: number;
}

/**
 * Calculate confidence score based on recognition result and match quality
 *
 * Confidence levels:
 * - 0.95: Exact match with student name
 * - 0.90: Exact match with nickname
 * - 0.70: Fuzzy match (Levenshtein distance = 1)
 * - 0.50: Fuzzy match (Levenshtein distance = 2)
 * - 0.30: Fuzzy match (Levenshtein distance >= 3)
 * - 0.00: No match or empty name
 *
 * @param recognizedName - Name recognized by OCR
 * @param matchResult - Match result from fuzzy matching
 * @returns Confidence score (0.0 - 1.0)
 */
export function calculateConfidence(recognizedName: string, matchResult: MatchResult): number {
  if (!recognizedName || !recognizedName.trim()) {
    return 0.0;
  }

  switch (matchResult.matchType) {
    case 'exact':
      return 0.95;

    case 'nickname':
      return 0.9;

    case 'fuzzy':
      if (matchResult.distance === 1) return 0.7;
      if (matchResult.distance === 2) return 0.5;
      return 0.3;

    case 'none':
    default:
      return 0.3;
  }
}

/**
 * Fuzzy match a recognized name against a list of students
 *
 * Matching priority:
 * 1. Exact match with student.name
 * 2. Exact match with student.nickname
 * 3. Fuzzy match with student.name (Levenshtein distance <= 2)
 *
 * @param recognizedName - Name recognized by OCR
 * @param students - List of students to match against
 * @returns Match result with the best matching student
 */
export function fuzzyMatchStudent(recognizedName: string, students: Student[]): MatchResult {
  if (!recognizedName || !recognizedName.trim()) {
    return {
      student: null,
      confidence: 0.0,
      matchType: 'none',
    };
  }

  const normalizedName = recognizedName.trim();

  // 1. Try exact match with name
  const exactMatch = students.find(s => s.name === normalizedName);
  if (exactMatch) {
    return {
      student: exactMatch,
      confidence: 0.95,
      matchType: 'exact',
      distance: 0,
    };
  }

  // 2. Try exact match with nickname
  const nicknameMatch = students.find(s => s.nickname && s.nickname === normalizedName);
  if (nicknameMatch) {
    return {
      student: nicknameMatch,
      confidence: 0.9,
      matchType: 'nickname',
      distance: 0,
    };
  }

  // 3. Try fuzzy match with name (Levenshtein distance)
  const fuzzyMatches = students
    .map(s => ({
      student: s,
      distance: levenshteinDistance(normalizedName, s.name),
    }))
    .sort((a, b) => a.distance - b.distance);

  const bestMatch = fuzzyMatches[0];

  // Only consider fuzzy matches with distance <= 2
  if (bestMatch && bestMatch.distance <= 2) {
    return {
      student: bestMatch.student,
      confidence: calculateConfidence(normalizedName, {
        student: bestMatch.student,
        confidence: 0,
        matchType: 'fuzzy',
        distance: bestMatch.distance,
      }),
      matchType: 'fuzzy',
      distance: bestMatch.distance,
    };
  }

  // No match found
  return {
    student: null,
    confidence: 0.3,
    matchType: 'none',
  };
}

/**
 * Batch match multiple recognized names against students
 *
 * @param recognizedNames - Array of recognized names
 * @param students - List of students to match against
 * @returns Array of match results
 */
export function batchFuzzyMatch(recognizedNames: string[], students: Student[]): MatchResult[] {
  return recognizedNames.map(name => fuzzyMatchStudent(name, students));
}
