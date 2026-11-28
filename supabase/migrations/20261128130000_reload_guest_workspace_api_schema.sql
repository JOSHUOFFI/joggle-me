-- Refresh PostgREST's cached function/table metadata after the guest workspace
-- migration added the server-only capability RPCs.
notify pgrst, 'reload schema';
