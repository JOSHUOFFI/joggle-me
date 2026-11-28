import type { PostgrestClient } from "@supabase/postgrest-js";
import type { StorageClient } from "@supabase/storage-js";

export type DatabaseClient = PostgrestClient & { storage: StorageClient };
