export function getPerformanceRemark(percentage: number) {
  if (percentage >= 90) return "Excellent work — you have a strong grasp of this material.";
  if (percentage >= 75) return "Great work — review the missed questions to strengthen your understanding.";
  if (percentage >= 50) return "Good effort — reviewing the key topics will help you improve.";
  return "Keep practising — revisit the source material and try again when you’re ready.";
}
