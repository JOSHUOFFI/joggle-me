alter table public.quiz_attempts
  add constraint quiz_attempts_id_user_unique unique (id, user_id);

create table public.exam_performance_recommendations (
  attempt_id uuid primary key,
  user_id uuid not null,
  generation_status text not null
    check (generation_status in ('ready', 'fallback')),
  recommendations jsonb not null
    check (
      jsonb_typeof(recommendations) = 'array'
      and jsonb_array_length(recommendations) between 1 and 5
    ),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_performance_recommendations_attempt_owner_fkey
    foreign key (attempt_id, user_id)
    references public.quiz_attempts(id, user_id)
    on delete cascade
);

alter table public.exam_performance_recommendations enable row level security;

create policy "Learners read own exam recommendations"
on public.exam_performance_recommendations for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

revoke all on public.exam_performance_recommendations
  from public, anon, authenticated;
grant select on public.exam_performance_recommendations to authenticated;
grant all on public.exam_performance_recommendations to service_role;
