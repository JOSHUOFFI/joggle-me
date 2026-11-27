create table public.learning_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt')),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  object_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'failed', 'deleting')),
  extraction_status text not null default 'queued'
    check (extraction_status in ('queued', 'processing', 'ready', 'failed')),
  analysis_status text not null default 'queued'
    check (analysis_status in ('queued', 'processing', 'ready', 'failed')),
  analysis jsonb,
  analysis_model text,
  analyzed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  processing_token uuid,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash),
  unique (id, user_id),
  constraint learning_document_analysis_state_check
    check (analysis_status <> 'ready' or analysis is not null),
  constraint learning_document_key_ownership_check
    check (split_part(object_key, '/', 1) = user_id::text)
);

create index learning_documents_user_created_idx
  on public.learning_documents (user_id, created_at desc);
create index learning_documents_processing_idx
  on public.learning_documents (status, updated_at)
  where status in ('queued', 'processing');

create table public.document_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null check (source_id ~ '^S[0-9]{3}$'),
  position integer not null check (position > 0),
  title text not null,
  text text not null check (length(text) > 0),
  page_or_location text not null,
  created_at timestamptz not null default now(),
  unique (document_id, source_id),
  unique (document_id, position),
  foreign key (document_id, user_id)
    references public.learning_documents(id, user_id)
    on delete cascade
);

create index document_sections_document_position_idx
  on public.document_sections (document_id, position);

alter table public.learning_documents enable row level security;
alter table public.document_sections enable row level security;

create policy "Learners read own learning documents"
on public.learning_documents for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Learners read own document sections"
on public.document_sections for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

revoke all on public.learning_documents from public, anon, authenticated;
grant select on public.learning_documents to authenticated;
revoke all on public.document_sections from public, anon, authenticated;
grant select on public.document_sections to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'learning-materials',
  'learning-materials',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Learners read own learning material objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'learning-materials'
  and exists (
    select 1
    from public.learning_documents d
    where d.object_key = name
      and d.user_id = auth.uid()
      and d.status <> 'deleting'
      and public.is_account_active(auth.uid())
  )
);

create policy "Learners delete only documents marked for deletion"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'learning-materials'
  and exists (
    select 1
    from public.learning_documents d
    where d.object_key = name
      and d.user_id = auth.uid()
      and d.status = 'deleting'
      and public.is_account_active(auth.uid())
  )
);

create or replace function public.create_learning_document(
  p_document_id uuid,
  p_original_filename text,
  p_file_type text,
  p_mime_type text,
  p_byte_size bigint,
  p_content_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_extension text;
  v_object_key text;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required';
  end if;
  if not public.is_feature_enabled('learning_material_uploads')
    or not public.is_feature_enabled('ai_document_analysis')
  then
    raise exception 'Learning material processing is unavailable';
  end if;

  v_extension := case p_file_type
    when 'pdf' then '.pdf'
    when 'docx' then '.docx'
    when 'txt' then '.txt'
    else null
  end;
  if v_extension is null then
    raise exception 'Unsupported document type';
  end if;
  if p_mime_type <> (case p_file_type
    when 'pdf' then 'application/pdf'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'txt' then 'text/plain'
    else ''
  end) then
    raise exception 'Document type and MIME type do not match';
  end if;
  if p_original_filename is null
    or length(trim(p_original_filename)) < 1
    or length(p_original_filename) > 180
    or position('/' in p_original_filename) > 0
    or position(chr(92) in p_original_filename) > 0
  then
    raise exception 'Invalid document filename';
  end if;
  if p_byte_size < 1 or p_byte_size > 52428800
    or p_content_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid document metadata';
  end if;

  v_object_key := v_user_id::text || '/' || p_document_id::text || v_extension;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'learning-materials'
      and o.name = v_object_key
  ) then
    raise exception 'Uploaded object was not found';
  end if;

  insert into public.learning_documents (
    id,
    user_id,
    original_filename,
    file_type,
    mime_type,
    byte_size,
    content_hash,
    object_key
  ) values (
    p_document_id,
    v_user_id,
    trim(p_original_filename),
    p_file_type,
    p_mime_type,
    p_byte_size,
    p_content_hash,
    v_object_key
  );
  return p_document_id;
end;
$$;

create or replace function public.retry_learning_document(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required';
  end if;
  if not public.is_feature_enabled('learning_material_uploads')
    or not public.is_feature_enabled('ai_document_analysis')
  then
    raise exception 'Learning material processing is unavailable';
  end if;

  update public.learning_documents d
  set status = 'queued',
      extraction_status = 'queued',
      analysis_status = 'queued',
      processing_token = null,
      error_code = null,
      error_message = null,
      updated_at = now()
  where d.id = p_document_id
    and d.user_id = v_user_id
    and (
      d.status = 'failed'
      or (
        d.status in ('queued', 'processing')
        and d.updated_at < now() - interval '10 minutes'
      )
    )
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'learning-materials'
        and o.name = d.object_key
    );
  return found;
end;
$$;

create or replace function public.begin_learning_document_delete(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_object_key text;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required';
  end if;

  select d.object_key into v_object_key
  from public.learning_documents d
  where d.id = p_document_id
    and d.user_id = v_user_id
  for update;

  if v_object_key is null then
    raise exception 'Document not found';
  end if;

  update public.learning_documents
  set status = 'deleting',
      processing_token = null,
      updated_at = now()
  where id = p_document_id and user_id = v_user_id;

  return v_object_key;
end;
$$;

create or replace function public.cancel_learning_document_delete(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_account_active(auth.uid()) then
    raise exception 'An active account is required';
  end if;

  update public.learning_documents
  set status = 'failed',
      error_code = 'delete_failed',
      error_message = 'We could not delete the stored file. Please try again.',
      updated_at = now()
  where id = p_document_id
    and user_id = auth.uid()
    and status = 'deleting';
end;
$$;

create or replace function public.finalize_learning_document_delete(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_object_key text;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required';
  end if;

  select d.object_key into v_object_key
  from public.learning_documents d
  where d.id = p_document_id
    and d.user_id = v_user_id
    and d.status = 'deleting'
  for update;
  if v_object_key is null then
    return false;
  end if;

  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'learning-materials'
      and o.name = v_object_key
  ) then
    return false;
  end if;

  delete from public.learning_documents
  where id = p_document_id and user_id = v_user_id;
  return found;
end;
$$;

create or replace function public.cancel_learning_document_upload(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_object_key text;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required';
  end if;

  select d.object_key into v_object_key
  from public.learning_documents d
  where d.id = p_document_id
    and d.user_id = v_user_id
    and d.status = 'queued';
  if v_object_key is null then
    return;
  end if;

  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'learning-materials'
      and o.name = v_object_key
  ) then
    update public.learning_documents
    set status = 'failed',
        extraction_status = 'failed',
        analysis_status = 'failed',
        processing_token = null,
        error_code = 'storage_failed',
        error_message = 'The upload could not be completed. Delete it and try again.',
        updated_at = now()
    where id = p_document_id and user_id = v_user_id;
  else
    delete from public.learning_documents
    where id = p_document_id and user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.create_learning_document(uuid, text, text, text, bigint, text)
  from public, anon;
revoke all on function public.retry_learning_document(uuid)
  from public, anon;
revoke all on function public.begin_learning_document_delete(uuid)
  from public, anon;
revoke all on function public.cancel_learning_document_delete(uuid)
  from public, anon;
revoke all on function public.finalize_learning_document_delete(uuid)
  from public, anon;
revoke all on function public.cancel_learning_document_upload(uuid)
  from public, anon;
grant execute on function public.create_learning_document(uuid, text, text, text, bigint, text)
  to authenticated;
grant execute on function public.retry_learning_document(uuid)
  to authenticated;
grant execute on function public.begin_learning_document_delete(uuid)
  to authenticated;
grant execute on function public.cancel_learning_document_delete(uuid)
  to authenticated;
grant execute on function public.finalize_learning_document_delete(uuid)
  to authenticated;
grant execute on function public.cancel_learning_document_upload(uuid)
  to authenticated;
