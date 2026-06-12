/**
 * Zod schemas for the Studio module.
 *
 * The studio has two persistent record types:
 * - `InboxEntry` — a raw capture (text, voice transcript, URL summary,
 *   git event). Stored as one markdown file per entry.
 * - `ClassifiedEntry` — same content plus `{ tags, urgency, project }`.
 *   Stored as a JSON sidecar next to the inbox file.
 *
 * Append-only: we never mutate an existing entry. Re-classifying creates
 * a new sidecar. This keeps the audit log honest and the format diffable.
 */
import { z } from 'zod';

export const InboxSourceSchema = z.enum(['text', 'voice', 'url', 'git', 'file', 'stdin']);
export type InboxSource = z.infer<typeof InboxSourceSchema>;

export const UrgencySchema = z.enum(['low', 'med', 'high']);
export type Urgency = z.infer<typeof UrgencySchema>;

export const InboxEntryFrontmatterSchema = z.object({
  id: z.string().min(1),
  source: InboxSourceSchema,
  captured_at: z.string().datetime(),
  schema_version: z.literal(1),
});
export type InboxEntryFrontmatter = z.infer<typeof InboxEntryFrontmatterSchema>;

export const ClassifiedEntrySchema = z.object({
  inbox_id: z.string().min(1),
  classified_at: z.string().datetime(),
  tags: z.array(z.string().min(1)).max(16),
  urgency: UrgencySchema,
  project: z.string().nullable(),
  // Optional reference back to a project.llmx/ project name (V2+).
  llmx_project: z.string().nullable(),
  schema_version: z.literal(1),
});
export type ClassifiedEntry = z.infer<typeof ClassifiedEntrySchema>;

export const StudioManifestSchema = z.object({
  llmxVersion: z.string().min(1),
  schemaVersion: z.literal(1),
  created_at: z.string().datetime(),
  counters: z.object({
    inbox: z.number().int().nonnegative(),
    classified: z.number().int().nonnegative(),
  }),
});
export type StudioManifest = z.infer<typeof StudioManifestSchema>;
