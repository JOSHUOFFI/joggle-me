"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deleteLearningDocumentAction,
  retryLearningDocumentAction,
} from "@/lib/actions/materials";

export type LearningDocumentSummary = {
  id: string;
  original_filename: string;
  file_type: "pdf" | "docx" | "txt";
  byte_size: number;
  status: "queued" | "processing" | "ready" | "failed" | "deleting";
  extraction_status: "queued" | "processing" | "ready" | "failed";
  analysis_status: "queued" | "processing" | "ready" | "failed";
  error_message: string | null;
  analysis: { title?: string } | null;
  created_at: string;
};

const responseSchema = z.object({
  documentId: z.uuid().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
});

function statusLabel(status: LearningDocumentSummary["status"]) {
  if (status === "queued") return "Waiting to process";
  if (status === "processing") return "Processing";
  if (status === "ready") return "Ready";
  if (status === "deleting") return "Deleting";
  return "Failed";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProcessingRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}

export function LearningMaterials({
  documents,
  uploadEnabled,
  maxUploadBytes,
  loadError,
  actionError,
}: {
  documents: LearningDocumentSummary[];
  uploadEnabled: boolean;
  maxUploadBytes: number;
  loadError: boolean;
  actionError?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [duplicateId, setDuplicateId] = useState("");
  const isProcessing = documents.some(
    (document) =>
      document.status === "queued" || document.status === "processing",
  );

  const upload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    setUploadError("");
    setUploadMessage("");
    setDuplicateId("");

    if (!file) {
      setUploadError("Choose a PDF, DOCX, or TXT file.");
      return;
    }
    if (file.size > maxUploadBytes) {
      setUploadError(
        `This file is larger than the ${Math.floor(maxUploadBytes / (1024 * 1024))} MB limit.`,
      );
      return;
    }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setUploadError("Choose a PDF, DOCX, or TXT file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/materials/upload");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    request.timeout = 120_000;
    request.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        setUploadProgress(
          Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 100)),
        );
      }
    };
    request.onload = () => {
      setUploading(false);
      setUploadProgress(null);
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        setUploadError("We couldn’t understand the upload response. Please retry.");
        router.refresh();
        return;
      }
      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        setUploadError("We couldn’t understand the upload response. Please retry.");
        return;
      }
      if (request.status === 409 && parsed.data.documentId) {
        setDuplicateId(parsed.data.documentId);
        setUploadMessage(
          parsed.data.message ?? "This document is already in your library.",
        );
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        setUploadError(
          parsed.data.message ?? "The upload failed. Please try again.",
        );
        return;
      }

      setUploadMessage(
        "Upload complete. Your document is processing in the background.",
      );
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    };
    request.onerror = () => {
      setUploading(false);
      setUploadProgress(null);
      setUploadError("The upload was interrupted. Check your connection and retry.");
      router.refresh();
    };
    request.ontimeout = () => {
      setUploading(false);
      setUploadProgress(null);
      setUploadError(
        "The upload took too long. Check your library before retrying.",
      );
      router.refresh();
    };
    request.send(file);
  };

  const actionErrorText = {
    invalid: "That document request is invalid.",
    disabled: "Uploads or document analysis are currently disabled.",
    retry: "This document could not be retried. Refresh and try again.",
    delete: "We couldn’t delete the document and its stored file. Please retry.",
  }[actionError ?? ""];

  return (
    <section id="learning-materials" aria-labelledby="materials-heading" className="mt-8 scroll-mt-24">
      <ProcessingRefresh active={isProcessing} />
      <div className="mb-4">
        <p className="text-sm font-bold text-[#7655D9]">Your library</p>
        <h2 id="materials-heading" className="mt-1 text-2xl font-black">
          Learning materials
        </h2>
        <p className="mt-1 text-sm text-[#77758A]">
          Upload study notes and get a source-linked overview.
        </p>
      </div>

      {actionErrorText && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionErrorText}
        </p>
      )}
      {loadError && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          Your document library couldn’t be loaded. Please refresh the page.
        </p>
      )}

      <Card className="p-5 sm:p-6">
        {uploadEnabled ? (
          <form onSubmit={upload} className="space-y-3">
            <label htmlFor="learning-material" className="block text-sm font-bold">
              Choose a document
            </label>
            <input
              ref={fileInput}
              id="learning-material"
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              disabled={uploading}
              className="block w-full rounded-xl border border-[#DDD8EF] bg-white p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F0ECFB] file:px-3 file:py-2 file:font-semibold file:text-[#35216B]"
            />
            <p className="text-xs text-[#77758A]">
              PDF, DOCX, or TXT · Up to {Math.floor(maxUploadBytes / (1024 * 1024))} MB
            </p>
            {uploadProgress !== null && (
              <div>
                <progress
                  className="h-2 w-full accent-[#7655D9]"
                  value={uploadProgress}
                  max={100}
                  aria-label="Upload progress"
                />
                <p className="text-xs text-[#77758A]" aria-live="polite">
                  Uploading… {uploadProgress}%
                </p>
              </div>
            )}
            {uploadError && <p className="text-sm text-red-700" role="alert">{uploadError}</p>}
            {uploadMessage && <p className="text-sm text-emerald-800" role="status">{uploadMessage}</p>}
            {duplicateId && (
              <Link
                className="inline-block text-sm font-bold text-[#7655D9]"
                href={`/dashboard/materials/${duplicateId}`}
              >
                View existing document
              </Link>
            )}
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload and analyse"}
            </Button>
          </form>
        ) : (
          <p className="text-sm leading-6 text-[#77758A]" role="status">
            Learning material uploads and AI analysis are not enabled yet. Ask
            the platform owner to enable both features.
          </p>
        )}
      </Card>

      <div className="mt-5 grid gap-3">
        {documents.length === 0 && !loadError ? (
          <Card className="p-6 text-sm text-[#77758A]">
            No learning materials yet. Upload a PDF, DOCX, or TXT file to get started.
          </Card>
        ) : (
          documents.map((document) => (
            <Card
              key={document.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/materials/${document.id}`}
                  className="break-words font-bold text-[#35216B] hover:text-[#7655D9]"
                >
                  {document.analysis?.title || document.original_filename}
                </Link>
                <p className="mt-1 text-xs text-[#77758A]">
                  {document.file_type.toUpperCase()} · {formatBytes(document.byte_size)} ·{" "}
                  {new Date(document.created_at).toISOString().slice(0, 10)}
                </p>
                <p className="mt-2 text-sm text-[#4E4B60]">
                  Processing: {statusLabel(document.status)} · Extraction:{" "}
                  {document.extraction_status} · Analysis: {document.analysis_status}
                </p>
                {document.error_message && (
                  <p className="mt-2 text-sm text-red-700" role="status">
                    {document.error_message}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {document.status !== "ready" &&
                  document.status !== "deleting" &&
                  uploadEnabled && (
                  <form action={retryLearningDocumentAction}>
                    <input type="hidden" name="documentId" value={document.id} />
                    <Button type="submit" variant="secondary">
                      {document.status === "failed" ? "Retry" : "Retry if stalled"}
                    </Button>
                  </form>
                )}
                <form action={deleteLearningDocumentAction}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <Button type="submit" variant="danger">Delete</Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
