"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CRM_OPTIONS,
  DEMO_INBOX,
  OPPORTUNITY_VOLUMES,
  TEAM_SIZES,
  validateDemoRequest,
  type DemoRequestInput,
  type FieldErrors,
} from "@/lib/marketing/demo-request";
import { submitDemoRequest } from "@/app/(marketing)/request-demo/actions";

/**
 * The demo request form.
 *
 * Validation runs on the client for speed and on the server for truth, both
 * from the one schema in lib/marketing/demo-request.ts. The client pass exists
 * so somebody who mistypes an email finds out immediately rather than after a
 * round trip; it decides nothing.
 *
 * Errors appear on blur and on submit, never on every keystroke - telling
 * someone their email is invalid while they are still on the third character
 * is noise, not help.
 *
 * Success replaces the form rather than firing a toast. A toast over a form
 * still full of the visitor's answers leaves them unsure whether it sent, and
 * invites a second submission.
 */

const EMPTY: DemoRequestInput = {
  fullName: "",
  workEmail: "",
  company: "",
  role: "",
  teamSize: "",
  crm: "",
  opportunityVolume: "",
  goal: "",
  heardFrom: "",
  website: "",
};

export function RequestDemoForm() {
  const [values, setValues] = useState<DemoRequestInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  function set<K extends keyof DemoRequestInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear a field's error as soon as it is touched: leaving a stale
    // complaint under an input the person is actively fixing reads as the form
    // not noticing them.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  /** Re-validates one field on blur, so problems surface where they happened. */
  function validateField(key: keyof DemoRequestInput) {
    const result = validateDemoRequest(values);
    if (result.ok) {
      setErrors((e) => ({ ...e, [key]: undefined }));
      return;
    }
    setErrors((e) => ({ ...e, [key]: result.errors[key] }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    setFormError(null);
    const result = validateDemoRequest(values);
    if (!result.ok) {
      setErrors(result.errors);
      // Move focus to the first problem rather than leaving the reader to
      // hunt for it in a ten-field form.
      const first = Object.keys(result.errors)[0];
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }

    startTransition(async () => {
      const response = await submitDemoRequest(values);
      if (response.ok) {
        setSubmitted(true);
        return;
      }
      if (response.errors) setErrors(response.errors);
      if (response.formError) setFormError(response.formError);
    });
  }

  if (submitted) return <SuccessState />;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="rounded-[20px] border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6 shadow-[var(--mkt-shadow-panel)] sm:p-8"
    >
      <h2 className="text-[17px] font-medium tracking-tight text-[var(--mkt-ink)]">
        Tell us about your pipeline
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--mkt-muted)]">
        Ten fields, about two minutes. Everything here shapes the walkthrough.
      </p>

      <div className="mt-6 grid gap-4">
        <Field
          id={`${baseId}-fullName`}
          name="fullName"
          label="Full name"
          required
          value={values.fullName}
          error={errors.fullName}
          onChange={(v) => set("fullName", v)}
          onBlur={() => validateField("fullName")}
          autoComplete="name"
        />

        <Field
          id={`${baseId}-workEmail`}
          name="workEmail"
          label="Work email"
          required
          type="email"
          placeholder="you@company.com"
          value={values.workEmail}
          error={errors.workEmail}
          onChange={(v) => set("workEmail", v)}
          onBlur={() => validateField("workEmail")}
          autoComplete="email"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${baseId}-company`}
            name="company"
            label="Company"
            required
            value={values.company}
            error={errors.company}
            onChange={(v) => set("company", v)}
            onBlur={() => validateField("company")}
            autoComplete="organization"
          />
          <Field
            id={`${baseId}-role`}
            name="role"
            label="Role / job title"
            required
            value={values.role}
            error={errors.role}
            onChange={(v) => set("role", v)}
            onBlur={() => validateField("role")}
            autoComplete="organization-title"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id={`${baseId}-teamSize`}
            name="teamSize"
            label="Sales team size"
            required
            placeholder="Select a size"
            options={TEAM_SIZES}
            value={values.teamSize}
            error={errors.teamSize}
            onChange={(v) => set("teamSize", v)}
          />
          <SelectField
            id={`${baseId}-crm`}
            name="crm"
            label="Current CRM"
            placeholder="Select a CRM"
            options={CRM_OPTIONS}
            value={values.crm ?? ""}
            error={errors.crm}
            onChange={(v) => set("crm", v)}
          />
        </div>

        <SelectField
          id={`${baseId}-opportunityVolume`}
          name="opportunityVolume"
          label="Monthly active opportunities"
          placeholder="Select a range"
          options={OPPORTUNITY_VOLUMES}
          value={values.opportunityVolume ?? ""}
          error={errors.opportunityVolume}
          onChange={(v) => set("opportunityVolume", v)}
        />

        <div className="grid gap-1.5">
          <Label htmlFor={`${baseId}-goal`} required>
            What would you like Selryn to improve?
          </Label>
          <textarea
            id={`${baseId}-goal`}
            name="goal"
            rows={4}
            value={values.goal}
            onChange={(e) => set("goal", e.target.value)}
            onBlur={() => validateField("goal")}
            aria-invalid={Boolean(errors.goal)}
            aria-describedby={errors.goal ? `${baseId}-goal-error` : undefined}
            placeholder="Deals go quiet after the demo and we find out too late."
            className={cn(inputClass, "resize-y leading-relaxed", errors.goal && errorClass)}
          />
          <FieldError id={`${baseId}-goal-error`} message={errors.goal} />
        </div>

        <Field
          id={`${baseId}-heardFrom`}
          name="heardFrom"
          label="How did you hear about us?"
          value={values.heardFrom ?? ""}
          error={errors.heardFrom}
          onChange={(v) => set("heardFrom", v)}
        />

        {/* Honeypot. Hidden from sight and from assistive technology, and
            skipped by the tab order, so no real person can reach it - which is
            what makes anything in it a reliable bot signal. */}
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
          <label htmlFor={`${baseId}-website`}>Website</label>
          <input
            id={`${baseId}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website ?? ""}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-[var(--mkt-danger)]/25 bg-[var(--mkt-danger)]/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--mkt-danger)]"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--mkt-brand)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-surface)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending your request
          </>
        ) : (
          <>
            Request my demo
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[12.5px] leading-relaxed text-[var(--mkt-muted)]">
        We use this only to prepare your walkthrough and reply to you.
      </p>
    </form>
  );
}

/* ── Success ─────────────────────────────────────────────────────────── */

/**
 * Replaces the form entirely.
 *
 * Only rendered once the server has confirmed the request is stored - never
 * on a hopeful client-side assumption, and never when a notification email
 * failed to send, because the request itself is safe in that case.
 */
function SuccessState() {
  return (
    <div
      role="status"
      className="rounded-[20px] border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-8 shadow-[var(--mkt-shadow-panel)] sm:p-10"
    >
      <span
        className="flex size-11 items-center justify-center rounded-full bg-[var(--mkt-success)]/10 text-[var(--mkt-success)]"
        aria-hidden
      >
        <Check className="size-5" strokeWidth={2.5} />
      </span>

      <h2 className="mt-5 text-2xl font-medium tracking-tight text-[var(--mkt-ink)]">
        Your request is in.
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--mkt-muted)]">
        We&apos;ll review your sales motion and get back to you within one
        business day.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--mkt-ink)] px-6 text-[14px] font-medium text-[var(--mkt-page)] transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
        >
          Try the guided demo
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full border border-[var(--mkt-line)] px-6 text-[14px] font-medium text-[var(--mkt-ink)] transition-colors hover:border-[var(--mkt-brand)] hover:text-[var(--mkt-brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)] focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </div>

      <p className="mt-7 border-t border-[var(--mkt-line)] pt-5 text-[13px] leading-relaxed text-[var(--mkt-muted)]">
        Need it sooner? Email{" "}
        <a
          href={`mailto:${DEMO_INBOX}`}
          className="font-medium text-[var(--mkt-ink)] underline decoration-[var(--mkt-line)] underline-offset-4 hover:text-[var(--mkt-brand-deep)]"
        >
          {DEMO_INBOX}
        </a>{" "}
        and mention your company name.
      </p>
    </div>
  );
}

/* ── Field primitives ────────────────────────────────────────────────── */

const inputClass =
  "w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3.5 py-2.5 text-[14.5px] text-[var(--mkt-ink)] transition-colors placeholder:text-[var(--mkt-muted)]/70 focus-visible:border-[var(--mkt-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-brand)]/25";

const errorClass = "border-[var(--mkt-danger)]/60";

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[13px] font-medium text-[var(--mkt-ink)]"
    >
      {children}
      {required && (
        <span className="ml-0.5 text-[var(--mkt-brand-deep)]" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

/** role="alert" so a screen reader hears the problem when it appears. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[12.5px] leading-snug text-[var(--mkt-danger)]">
      {message}
    </p>
  );
}

function Field({
  id,
  name,
  label,
  value,
  error,
  onChange,
  onBlur,
  required,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && errorClass)}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * A native select rather than the Radix one used inside the app.
 *
 * On a public marketing form the native control is the more reliable choice:
 * it works before hydration, uses the platform picker on mobile, and needs no
 * JavaScript to be operable.
 */
function SelectField({
  id,
  name,
  label,
  options,
  value,
  error,
  onChange,
  required,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          inputClass,
          "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235f6461%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10",
          !value && "text-[var(--mkt-muted)]",
          error && errorClass
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-[var(--mkt-ink)]">
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
