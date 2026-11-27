create table public.learning_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  question_count integer not null check (question_count between 1 and 30),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  selected_topics text[] not null check (cardinality(selected_topics) > 0),
  questions jsonb,
  generation_status text not null default 'generating'
    check (generation_status in ('generating', 'ready', 'failed')),
  generation_model text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_quizzes_document_owner_fkey
    foreign key (source_document_id, user_id)
    references public.learning_documents(id, user_id)
    on delete cascade,
  constraint learning_quizzes_generation_state_check
    check (
      (
        generation_status = 'ready'
        and questions is not null
        and jsonb_typeof(questions) = 'array'
        and jsonb_array_length(questions) = question_count
      )
      or (
        generation_status <> 'ready'
        and questions is null
      )
    )
);

create index learning_quizzes_user_created_idx
  on public.learning_quizzes (user_id, created_at desc);
create index learning_quizzes_source_document_idx
  on public.learning_quizzes (source_document_id, user_id);

alter table public.learning_quizzes enable row level security;

create policy "Learners read own quizzes"
on public.learning_quizzes for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

create policy "Learners delete own quizzes"
on public.learning_quizzes for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

revoke all on public.learning_quizzes from public, anon, authenticated;
grant select, delete on public.learning_quizzes to authenticated;
grant all on public.learning_quizzes to service_role;
