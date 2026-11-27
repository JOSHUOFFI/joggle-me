-- Run only against an isolated Supabase development database.
-- This transaction creates synthetic rows and rolls them back.
-- Execute after 20261125010000_phase2_learning_materials.sql is applied.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Learners delete only documents marked for deletion'
      and cmd = 'DELETE'
      and qual ilike '%user_id%'
      and qual ilike '%deleting%'
  ) then
    raise exception 'Storage deletion policy is missing its ownership or deletion-state guard';
  end if;
end;
$$;

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000011';
  learner_two uuid := '10000000-0000-4000-8000-000000000012';
  document_one uuid := '20000000-0000-4000-8000-000000000011';
  document_two uuid := '20000000-0000-4000-8000-000000000012';
  rpc_document uuid := '20000000-0000-4000-8000-000000000013';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase2-learner-one@example.invalid', now()),
    (learner_two, 'phase2-learner-two@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 2', 'One', 'phase2-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 2', 'Two', 'phase2-learner-two@example.invalid', 'independent', 'active')
  on conflict (id) do update set account_status = 'active';

  insert into public.user_roles (user_id, role)
  values (learner_one, 'learner'), (learner_two, 'learner')
  on conflict do nothing;

  update public.feature_flags
  set enabled = true
  where key in ('learning_material_uploads', 'ai_document_analysis');

  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values
    (
      'learning-materials',
      learner_one::text || '/' || document_one::text || '.pdf',
      learner_one::text,
      '{"size":"1024","mimetype":"application/pdf"}'::jsonb
    ),
    (
      'learning-materials',
      learner_two::text || '/' || document_two::text || '.pdf',
      learner_two::text,
      '{"size":"1024","mimetype":"application/pdf"}'::jsonb
    ),
    (
      'learning-materials',
      learner_one::text || '/' || rpc_document::text || '.pdf',
      learner_one::text,
      '{"size":"1024","mimetype":"application/pdf"}'::jsonb
    );

  insert into public.learning_documents (
    id, user_id, original_filename, file_type, mime_type, byte_size,
    content_hash, object_key, status, extraction_status, analysis_status,
    error_code, error_message
  )
  values
    (
      document_one, learner_one, 'one.pdf', 'pdf', 'application/pdf', 1024,
      repeat('1', 64), learner_one::text || '/' || document_one::text || '.pdf',
      'failed', 'failed', 'failed', 'test_failure', 'Synthetic failure'
    ),
    (
      document_two, learner_two, 'two.pdf', 'pdf', 'application/pdf', 1024,
      repeat('2', 64), learner_two::text || '/' || document_two::text || '.pdf',
      'failed', 'failed', 'failed', 'test_failure', 'Synthetic failure'
    );

  insert into public.document_sections (
    document_id, user_id, source_id, position, title, text, page_or_location
  )
  values
    (document_one, learner_one, 'S001', 1, 'One', 'Learner one source', 'Page 1'),
    (document_two, learner_two, 'S001', 1, 'Two', 'Learner two source', 'Page 1');
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000011',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
  document_key text;
  deleted boolean;
begin
  if (
    select count(*) from public.learning_documents
    where user_id = '10000000-0000-4000-8000-000000000011'
  ) <> 1 then
    raise exception 'learner cannot read their own document';
  end if;
  if exists (
    select 1 from public.learning_documents
    where id = '20000000-0000-4000-8000-000000000012'
  ) then
    raise exception 'learner can read another learner document';
  end if;
  if exists (
    select 1 from public.document_sections
    where document_id = '20000000-0000-4000-8000-000000000012'
  ) then
    raise exception 'learner can read another learner source text';
  end if;
  if (
    select count(*) from storage.objects
    where bucket_id = 'learning-materials'
  ) <> 1 then
    raise exception 'storage object policy did not isolate learner files';
  end if;

  begin
    insert into public.learning_documents (
      id, user_id, original_filename, file_type, mime_type, byte_size,
      content_hash, object_key
    ) values (
      gen_random_uuid(),
      '10000000-0000-4000-8000-000000000011',
      'forged.pdf',
      'pdf',
      'application/pdf',
      1024,
      repeat('3', 64),
      '10000000-0000-4000-8000-000000000011/forged.pdf'
    );
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner inserted document metadata outside the upload RPC';
  end if;

  if public.create_learning_document(
    '20000000-0000-4000-8000-000000000013',
    'created.pdf',
    'pdf',
    'application/pdf',
    1024,
    repeat('3', 64)
  ) <> '20000000-0000-4000-8000-000000000013'::uuid then
    raise exception 'learner could not create an owned document for an uploaded object';
  end if;

  document_key := public.begin_learning_document_delete(
    '20000000-0000-4000-8000-000000000011'
  );
  if document_key <> '10000000-0000-4000-8000-000000000011/20000000-0000-4000-8000-000000000011.pdf' then
    raise exception 'learner received another document object key';
  end if;

  rejected := false;
  begin
    perform public.begin_learning_document_delete(
      '20000000-0000-4000-8000-000000000012'
    );
  exception when raise_exception then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner began deletion of another learner document';
  end if;

  deleted := public.finalize_learning_document_delete(
    '20000000-0000-4000-8000-000000000011'
  );
  if deleted then
    raise exception 'document was finalized while its Storage object still exists';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'learning-materials'
      and name = document_key
  ) then
    raise exception 'deleting document remains visible through the Storage read policy';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000012',
  true
);
set local role authenticated;

do $$
begin
  if (
    select count(*) from public.learning_documents
    where user_id = '10000000-0000-4000-8000-000000000012'
  ) <> 1 then
    raise exception 'second learner cannot read their own document';
  end if;
  if exists (
    select 1 from public.learning_documents
    where user_id = '10000000-0000-4000-8000-000000000011'
  ) then
    raise exception 'second learner can read another learner document';
  end if;
end;
$$;

rollback;
