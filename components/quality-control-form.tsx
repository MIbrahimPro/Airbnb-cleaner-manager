"use client";

import {
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const properties = [
  "1 New Road",
  "124 George Street",
  "174 Filton Avenue",
  "240 Filton Avenue (2)",
  "267 Muller Road",
  "30 Lancelot Road",
  "31 Hinton Road",
  "34 Nibley Road",
  "414 Paintworks",
  "50 Picton Street",
  "6 Dugar Walk",
  "638 Stapleton",
  "678 Stapleton",
  "90 Ringwood",
  "Jersey — 113B",
  "Jersey — 113A",
  "Kenham House",
];

const cleaners = [
  "Aneeq",
  "Irfan",
  "Lawrence",
  "Elina",
  "Emily",
  "Backup Cleaner 1",
  "Backup Cleaner 2",
  "Backup Cleaner 3",
  "Backup Cleaner 4",
];

const cleanTypes = ["Standard Changeover", "Deep Clean", "Owner Stay"] as const;

type CleanType = (typeof cleanTypes)[number];

type PhotoPreview = {
  id: string;
  file: File;
  url: string;
};

function getLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function QualityControlForm() {
  const [property, setProperty] = useState(properties[0]);
  const [cleaner, setCleaner] = useState(cleaners[0]);
  const [scheduledAt, setScheduledAt] = useState(getLocalDateTimeValue);
  const [cleanType, setCleanType] = useState<CleanType>("Standard Changeover");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [photos]);

  useEffect(() => {
    if (!textAreaRef.current) {
      return;
    }

    textAreaRef.current.style.height = "0px";
    textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
  }, [notes]);

  const canSubmit = property && cleaner && scheduledAt && !isSubmitting;

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextPhotos = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      }));

    setPhotos((current) => [...current, ...nextPhotos]);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.url);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setShowFeedback(false);

    window.setTimeout(() => {
      setIsSubmitting(false);
      setShowFeedback(true);
    }, 1200);
  }

  return (
    <main className="min-h-[100dvh] px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:grid lg:grid-cols-[0.82fr_1.18fr] lg:gap-8">
        <aside className="lg:sticky lg:top-8 lg:h-fit">
          <div className="rounded-[32px] border border-white/70 bg-white/65 p-6 shadow-apple-soft backdrop-blur-2xl sm:p-8">
            <div className="mb-8 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-[0_10px_24px_-18px_rgba(29,29,31,0.4)]">
              <ClipboardCheck aria-hidden="true" className="h-6 w-6 text-neutral-900" strokeWidth={1.8} />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              AI quality control
            </p>
            <h1 className="text-[clamp(2.25rem,9vw,4.65rem)] font-semibold leading-[0.96] tracking-[-0.035em] text-neutral-950">
              Cleaner inspection.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-neutral-600">
              Submit the property, cleaner, clean type, notes, and on-site photos from a phone-friendly workflow.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <StatusPill label="Photos" value={`${photos.length}`} />
              <StatusPill label="Clean" value={cleanType.replace("Standard ", "")} />
            </div>
          </div>
        </aside>

        <section className="rounded-[34px] border border-white/70 bg-white/80 p-4 shadow-apple-soft backdrop-blur-2xl sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="rounded-[28px] border border-neutral-100 bg-neutral-50/80 p-4 sm:p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SearchableSelect
                  label="Property"
                  value={property}
                  options={properties}
                  onChange={setProperty}
                  icon={<Search aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />}
                />
                <Field label="Cleaner" helper="Assigned cleaner completing this inspection.">
                  <div className="relative">
                    <UserRound
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                      strokeWidth={1.8}
                    />
                    <select
                      aria-label="Cleaner"
                      value={cleaner}
                      onChange={(event) => setCleaner(event.target.value)}
                      className="h-[52px] w-full appearance-none rounded-2xl border border-neutral-200 bg-white px-11 pr-10 text-[15px] font-medium text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-950/5"
                    >
                      {cleaners.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                      strokeWidth={1.8}
                    />
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-[28px] border border-neutral-100 bg-white p-4 sm:p-5">
              <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
                <Field label="Date and time" helper="Pre-filled to the current local time.">
                  <div className="relative">
                    <CalendarClock
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                      strokeWidth={1.8}
                    />
                    <input
                      aria-label="Date and time"
                      suppressHydrationWarning
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-11 text-[15px] font-medium text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-950/5"
                    />
                  </div>
                </Field>

                <Field label="Type of clean" helper="Choose the inspection context.">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {cleanTypes.map((type) => {
                      const isSelected = cleanType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCleanType(type)}
                          className={`min-h-[52px] rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
                            isSelected
                              ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_16px_36px_-24px_rgba(29,29,31,0.8)]"
                              : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            {type}
                            {isSelected ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2} /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-[28px] border border-neutral-100 bg-white p-4 sm:p-5">
              <Field label="Notes and issues" helper="Capture anything the AI should consider while reviewing photos.">
                <textarea
                  aria-label="Notes and issues"
                  ref={textAreaRef}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Add linen issues, maintenance notes, missing supplies, or access details."
                  className="max-h-64 min-h-[132px] w-full resize-none overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-[15px] leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-950/5"
                />
              </Field>
            </div>

            <div className="rounded-[28px] border border-neutral-100 bg-white p-4 sm:p-5">
              <Field label="Inspection photos" helper="Tap to open the camera or choose multiple images from the device.">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    addFiles(event.dataTransfer.files);
                  }}
                  className="group flex min-h-[164px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-300 bg-neutral-50 px-5 py-7 text-center transition hover:border-neutral-400 hover:bg-white focus:outline-none focus:ring-4 focus:ring-neutral-950/5 active:scale-[0.99]"
                >
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-[0_14px_34px_-24px_rgba(29,29,31,0.75)] transition group-hover:-translate-y-0.5">
                    <Camera aria-hidden="true" className="h-6 w-6 text-neutral-900" strokeWidth={1.8} />
                  </span>
                  <span className="text-base font-semibold text-neutral-950">Add inspection photos</span>
                  <span className="mt-1 max-w-xs text-sm leading-6 text-neutral-500">
                    Camera capture, multi-select, drag and drop, with instant previews below.
                  </span>
                  <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800">
                    <UploadCloud aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    Choose photos
                  </span>
                </button>

                {photos.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((photo) => (
                      <figure
                        key={photo.id}
                        className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.file.name} className="h-full w-full object-cover" />
                        <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-neutral-950/70 to-transparent px-3 pb-3 pt-10 text-xs font-medium text-white">
                          {photo.file.name}
                        </figcaption>
                        <button
                          type="button"
                          aria-label={`Remove ${photo.file.name}`}
                          onClick={() => removePhoto(photo.id)}
                          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/90 text-neutral-900 shadow-sm backdrop-blur-md transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-white/70 active:scale-95"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </Field>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="group flex min-h-14 items-center justify-center gap-3 rounded-full bg-neutral-950 px-6 py-4 text-base font-semibold text-white shadow-[0_22px_44px_-26px_rgba(29,29,31,0.88)] transition hover:-translate-y-0.5 hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-950/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={1.9} />
                  Reviewing inspection
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" className="h-5 w-5 transition group-hover:rotate-6" strokeWidth={1.9} />
                  Submit Inspection
                </>
              )}
            </button>
          </form>
        </section>
      </div>

      {showFeedback ? (
        <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:bottom-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-950">Inspection submitted</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Mock AI feedback: photos are ready for quality review. No urgent blockers detected from this submission.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss feedback"
              onClick={() => setShowFeedback(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-950/5"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-neutral-950">{label}</span>
      <span className="text-xs leading-5 text-neutral-500">{helper}</span>
      {children}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function chooseOption(option: string) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" && filteredOptions[0]) {
      event.preventDefault();
      chooseOption(filteredOptions[0]);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Field label={label} helper="Search or select the property being inspected.">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">{icon}</span>
          <input
            aria-label="Property"
            ref={inputRef}
            value={open ? query : value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            onKeyDown={handleKeyDown}
            aria-expanded={open}
            aria-controls="property-listbox"
            aria-autocomplete="list"
            role="combobox"
            className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-white px-11 pr-10 text-[15px] font-medium text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-950/5"
          />
          <ChevronDown
            aria-hidden="true"
            className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 transition ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.8}
          />
        </div>
      </Field>

      {open ? (
        <div
          id="property-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-auto rounded-3xl border border-neutral-200 bg-white/95 p-2 shadow-[0_24px_60px_-34px_rgba(29,29,31,0.55)] backdrop-blur-xl"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => chooseOption(option)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-neutral-950 font-semibold text-white"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                >
                  <span>{option}</span>
                  {isSelected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">No property matches that search.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
