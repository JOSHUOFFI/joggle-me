drop policy if exists "Learners block other community members"
on public.community_blocks;

create policy "Learners block other community members"
on public.community_blocks for insert to authenticated
with check (
  blocker_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_enabled')
  and public.is_account_active(blocked_id)
  and public.community_is_active_learner(blocked_id)
);
