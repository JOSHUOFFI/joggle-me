// Deployment-level switches replace the removed account-based feature editor.
const features: Record<string, boolean> = {
  ai_document_analysis: true,
  ai_quiz_generation: true,
  examination_functionality: true,
  learning_material_uploads: true,
  gamification: false,
  social_learning: false,
  community_enabled: false,
  community_notifications_enabled: false,
  community_posts_enabled: false,
  community_questions_enabled: false,
  study_groups_enabled: false,
};

export async function isFeatureEnabled(_context: unknown, key: string) {
  return /^[a-z][a-z0-9_]{1,99}$/.test(key) && features[key] === true;
}

export function getFeatureSnapshot() {
  return { ...features };
}
