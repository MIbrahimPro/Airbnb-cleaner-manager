"use client";

import {
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Loader2,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
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

const cleanTypeLabels: Record<CleanType, string> = {
  "Standard Changeover": "Standard",
  "Deep Clean": "Deep",
  "Owner Stay": "Owner",
};

type PhotoPreview = {
  id: string;
  file: File;
  url: string;
};

type CleanerSession = {
  cleaner: string;
  signedInAt: string;
};

function getLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function sanitizeCleanerName(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePassword(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128);
}

function normalizeCleanerName(value: string) {
  return sanitizeCleanerName(value).toLocaleLowerCase();
}

export function QualityControlForm() {
  const [session, setSession] = useState<CleanerSession | null>(null);
  const [property, setProperty] = useState(properties[0]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [cleanType, setCleanType] = useState<CleanType>("Standard Changeover");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScheduledAt(getLocalDateTimeValue());
  }, []);

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
    textAreaRef.current.style.height = `${Math.max(textAreaRef.current.scrollHeight, 116)}px`;
  }, [notes]);

  const canSubmit = property && session?.cleaner && scheduledAt && !isSubmitting;

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
    }, 1100);
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2f2f7] text-[#1c1c1e]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[760px] flex-col px-4 pb-28 pt-4 sm:px-6 sm:pt-8">
        <header className="mb-5 border-b border-black/[0.06] pb-4 sm:mb-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium leading-5 text-[#6e6e73]">AI Cleaner QC</p>
              <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.022em] text-[#1d1d1f] sm:text-[42px]">
                Inspection
              </h1>
              <p className="mt-2 text-[15px] leading-5 text-[#6e6e73]">Signed in as {session.cleaner}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => setSession(null)}
              className="flex h-11 min-w-11 items-center justify-center rounded-[12px] border border-black/[0.06] bg-white text-[#007aff] shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition hover:bg-[#f9f9fb] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.97]"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-7">
          <SettingsSection
            title="Property"
            footer="Cleaner identity is set from the signed-in account."
          >
            <SearchableSelect
              label="Property"
              value={property}
              options={properties}
              onChange={setProperty}
              icon={<Home aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            />
            <RowDivider />
            <SettingsRow
              label="Cleaner"
              icon={<UserCheck aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            >
              <p className="min-w-0 truncate text-right text-[16px] font-normal text-[#007aff]">{session.cleaner}</p>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection title="Clean Configuration">
            <SettingsRow
              label="Date & Time"
              icon={<Clock3 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            >
              <input
                aria-label="Date and time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-right text-[15px] font-normal text-[#007aff] outline-none [color-scheme:light]"
              />
            </SettingsRow>
            <RowDivider />
            <div className="px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[16px] font-normal text-[#1c1c1e]">Type of Clean</span>
                <span className="text-[13px] text-[#8e8e93]">{cleanType}</span>
              </div>
              <div className="grid grid-cols-3 rounded-[10px] bg-[#e5e5ea] p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
                {cleanTypes.map((type) => {
                  const isSelected = cleanType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCleanType(type)}
                      className={`min-h-9 rounded-[8px] px-2 text-[13px] font-medium leading-none tracking-[-0.01em] transition active:scale-[0.98] ${
                        isSelected
                          ? "bg-white text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.14)]"
                          : "text-[#3a3a3c] hover:text-[#1c1c1e]"
                      }`}
                    >
                      <span className="block truncate sm:hidden">{cleanTypeLabels[type]}</span>
                      <span className="hidden truncate sm:block">{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Report"
            footer="Notes and images stay local in this mock flow. The submit action simulates AI feedback."
          >
            <div className="px-4 py-3">
              <label className="mb-2 block text-[16px] font-normal text-[#1c1c1e]" htmlFor="notes">
                Notes / Issues
              </label>
              <textarea
                id="notes"
                ref={textAreaRef}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Linen issue, maintenance note, missing supplies..."
                className="max-h-64 min-h-[116px] w-full resize-none overflow-hidden rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 py-3 text-[16px] leading-6 text-[#1c1c1e] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
              />
            </div>
            <RowDivider />
            <div className="px-4 py-3">
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
                className="flex min-h-[72px] w-full items-center gap-3 rounded-[12px] border border-dashed border-black/[0.14] bg-[#f9f9fb] px-3 py-3 text-left transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#007aff] text-white">
                  <Camera aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium text-[#1c1c1e]">Add Photos</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#6e6e73]">
                    Camera capture or multi-select from library.
                  </span>
                </span>
                <Upload aria-hidden="true" className="h-5 w-5 shrink-0 text-[#8e8e93]" strokeWidth={2} />
              </button>

              {photos.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#e5e5ea]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove ${photo.file.name}`}
                        onClick={() => removePhoto(photo.id)}
                        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/70 focus:outline-none focus:ring-4 focus:ring-white/70 active:scale-95"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </SettingsSection>

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#007aff] px-5 text-[17px] font-semibold text-white shadow-[0_10px_24px_-18px_rgba(0,122,255,0.9)] transition hover:bg-[#006ee6] focus:outline-none focus:ring-4 focus:ring-[#007aff]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c7c7cc] disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2} />
                Reviewing
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                Submit Inspection
              </>
            )}
          </button>
        </form>
      </div>

      {showFeedback ? (
        <div className="fixed inset-x-3 bottom-4 mx-auto max-w-[520px] rounded-[18px] border border-black/[0.06] bg-white/95 p-4 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#34c759]/10 text-[#248a3d]">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#1c1c1e]">Inspection submitted</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">
                Mock AI feedback: photos are ready for review. No urgent blockers detected.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss feedback"
              onClick={() => setShowFeedback(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition hover:bg-[#f2f2f7] hover:text-[#1c1c1e] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: CleanerSession) => void }) {
  const [cleanerInput, setCleanerInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sanitizedCleaner = sanitizeCleanerName(cleanerInput);
    const sanitizedPassword = sanitizePassword(password);
    const matchedCleaner = cleaners.find((cleaner) => normalizeCleanerName(cleaner) === normalizeCleanerName(sanitizedCleaner));

    if (!sanitizedCleaner) {
      setError("Enter your name.");
      return;
    }

    if (!sanitizedPassword) {
      setError("Enter your password.");
      return;
    }

    setError("");
    setIsSigningIn(true);

    window.setTimeout(() => {
      onLogin({
        cleaner: matchedCleaner ?? sanitizedCleaner,
        signedInAt: getLocalDateTimeValue(),
      });
    }, 450);
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2f2f7] text-[#1c1c1e]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col justify-center px-4 py-8 sm:px-6">
        <header className="mb-7">
          <p className="text-[13px] font-medium leading-5 text-[#6e6e73]">AI Cleaner QC</p>
          <h1 className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.024em] text-[#1d1d1f]">
            Sign in
          </h1>
          <p className="mt-3 text-[16px] leading-6 text-[#6e6e73]">
            Use your cleaner account to start an inspection.
          </p>
        </header>

        <form onSubmit={handleLogin} className="space-y-7">
          <SettingsSection title="Cleaner Access">
            <SettingsRow
              label="Name"
              icon={<UserRound aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            >
              <input
                aria-label="Cleaner name"
                value={cleanerInput}
                onChange={(event) => {
                  setCleanerInput(sanitizeCleanerName(event.target.value));
                  setError("");
                }}
                placeholder="Aneeq"
                autoComplete="name"
                className="h-11 min-w-0 flex-1 bg-transparent text-right text-[16px] font-normal text-[#007aff] outline-none placeholder:text-[#8e8e93]"
              />
            </SettingsRow>
            <RowDivider />
            <SettingsRow
              label="Password"
              icon={<KeyRound aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            >
              <input
                aria-label="Password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(sanitizePassword(event.target.value));
                  setError("");
                }}
                placeholder="Password"
                autoComplete="current-password"
                className="h-11 min-w-0 flex-1 bg-transparent text-right text-[16px] font-normal text-[#007aff] outline-none placeholder:text-[#8e8e93]"
              />
            </SettingsRow>
          </SettingsSection>

          {error ? <p className="px-4 text-[14px] leading-5 text-[#ff3b30]">{error}</p> : null}

          <button
            type="submit"
            disabled={isSigningIn}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#007aff] px-5 text-[17px] font-semibold text-white shadow-[0_10px_24px_-18px_rgba(0,122,255,0.9)] transition hover:bg-[#006ee6] focus:outline-none focus:ring-4 focus:ring-[#007aff]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c7c7cc] disabled:shadow-none"
          >
            {isSigningIn ? (
              <>
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2} />
                Signing in
              </>
            ) : (
              <>
                <LogIn aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                Continue
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-4 text-[13px] font-medium uppercase tracking-normal text-[#6e6e73]">{title}</h2>
      <div className="overflow-visible rounded-[14px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {children}
      </div>
      {footer ? <p className="mt-2 px-4 text-[13px] leading-5 text-[#6e6e73]">{footer}</p> : null}
    </section>
  );
}

function SettingsRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-1.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f2f2f7] text-[#007aff]">
        {icon}
      </span>
      <span className="shrink-0 text-[16px] font-normal text-[#1c1c1e]">{label}</span>
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  );
}

function RowDivider() {
  return <div className="ml-[64px] h-px bg-black/[0.08]" />;
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
  icon: ReactNode;
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
      <SettingsRow label={label} icon={icon}>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className={`pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93] transition ${
              open ? "opacity-100" : "opacity-0"
            }`}
            strokeWidth={2}
          />
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
            className={`h-11 w-full rounded-[10px] bg-transparent text-right text-[16px] font-normal text-[#007aff] outline-none transition placeholder:text-[#8e8e93] focus:bg-[#f9f9fb] focus:ring-4 focus:ring-[#007aff]/10 ${
              open ? "pl-8 pr-3 text-left" : "px-0"
            }`}
          />
        </div>
      </SettingsRow>

      {open ? (
        <div
          id="property-listbox"
          role="listbox"
          className="absolute inset-x-2 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-auto rounded-[14px] border border-black/[0.08] bg-white/98 p-1.5 shadow-[0_18px_42px_-22px_rgba(0,0,0,0.42)] backdrop-blur-xl"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => chooseOption(option)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] text-[#1c1c1e] transition hover:bg-[#f2f2f7] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10"
                >
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {isSelected ? <Check aria-hidden="true" className="h-5 w-5 text-[#007aff]" strokeWidth={2} /> : null}
                  {index === 0 && !isSelected && filteredOptions.length === 1 ? (
                    <CircleAlert aria-hidden="true" className="h-4 w-4 text-[#8e8e93]" strokeWidth={2} />
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-5 text-center text-[14px] text-[#6e6e73]">No property matches that search.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
