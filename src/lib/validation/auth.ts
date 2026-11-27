import { z } from "zod";

export const registrationSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{3,30}$/),
    email: z.email(),
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const resetRequestSchema = z.object({
  email: z.email(),
});

export const passwordResetSchema = z
  .object({
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,30}$/),
  phoneNumber: z.string().trim().max(30).optional(),
  profileImageUrl: z.url().optional().or(z.literal("")),
  learnerCategory: z.enum([
    "secondary_school",
    "university",
    "independent",
  ]),
  institution: z.string().trim().max(160).optional(),
});
