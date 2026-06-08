"use client";

import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  ImageIcon,
  KeyRound,
  LogIn,
  LogOut,
  Loader2,
  MapPinned,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

const maxClientImageBytes = 1.8 * 1024 * 1024;
const maxClientImageDimension = 1800;

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "CLEANER" | "MANAGER" | "ADMIN";
};

type PropertySummary = {
  id: string;
  name: string;
  coverImage: string;
  taskCount: number;
};

type PropertyTask = {
  id: string;
  taskName: string;
  referenceImageUrl: string;
};

type PropertyDetail = {
  id: string;
  name: string;
  coverImage: string;
  tasks: PropertyTask[];
};

type PhotoPreview = {
  id: string;
  file: File;
  url: string;
};

type AiEvaluation = {
  status: "PASS" | "FAIL";
  feedback: string;
  model?: string;
  sessionId?: string;
  appealed?: boolean;
  totalScore?: number;
};

type SessionTaskStatus = {
  taskName: string;
  status: "PENDING" | "PASS" | "FAIL";
  appealed: boolean;
  aiFeedback: string;
  liveImageUrl: string;
};

type SessionStatus = {
  id: string;
  totalScore: number;
  finalized: boolean;
  resolvedCount: number;
  taskCount: number;
  canFinalize: boolean;
  tasks: SessionTaskStatus[];
};

type AdminProperty = PropertyDetail & {
  taskCount: number;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: AppUser["role"];
  active: boolean;
};

type HistorySession = {
  id: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  totalScore: number;
  finalized: boolean;
  updatedAt: string;
  taskCount: number;
  failedCount: number;
  appealedCount: number;
  failedTasks: {
    taskName: string;
    appealed: boolean;
    aiFeedback: string;
    cleanerNotes: string;
    liveImageUrl: string;
  }[];
};

type AdminTab = "properties" | "cleaners" | "history";

type TaskDraft = {
  taskName: string;
  file: File | null;
};

type Screen = "properties" | "tasks" | "inspection";

function getLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatLocalDateTimeValue(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function sanitizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 160);
}

function sanitizePassword(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128);
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/") || file.size <= maxClientImageBytes) {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxClientImageDimension / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();
    return file;
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function buildPropertyFormData({
  role,
  name,
  coverFile,
}: {
  role: AppUser["role"];
  name: string;
  coverFile: File | null;
}) {
  const formData = new FormData();
  formData.append("role", role);
  formData.append("name", name);

  if (coverFile) {
    formData.append("coverFile", await compressImageFile(coverFile));
  }

  return formData;
}

export function QualityControlForm() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [screen, setScreen] = useState<Screen>("properties");
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyDetail | null>(null);
  const [selectedTask, setSelectedTask] = useState<PropertyTask | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState("");

  const loadProperties = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");

    try {
      const response = await fetch("/api/properties", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load properties.");
      }

      setProperties(data.properties);
      setLoadState("idle");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load properties.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadProperties();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProperties, user]);

  const loadSessionStatus = useCallback(
    async (propertyId?: string) => {
      const targetPropertyId = propertyId ?? selectedProperty?.id;

      if (!targetPropertyId || !user) {
        return null;
      }

      const params = new URLSearchParams({
        propertyId: targetPropertyId,
        cleanerName: user.name,
      });
      const response = await fetch(`/api/session/status?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load session status.");
      }

      setSessionStatus(data.session);
      setShowComplete(Boolean(data.session.finalized));
      return data.session as SessionStatus;
    },
    [selectedProperty?.id, user],
  );

  async function openProperty(propertyId: string) {
    setLoadState("loading");
    setLoadError("");
    setSessionStatus(null);
    setShowComplete(false);

    try {
      const response = await fetch(`/api/properties/${propertyId}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load property.");
      }

      setSelectedProperty(data.property);
      setSelectedTask(null);
      setScreen("tasks");
      await loadSessionStatus(data.property.id);
      setLoadState("idle");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load property.");
      setLoadState("error");
    }
  }

  async function finalizeSession() {
    if (!sessionStatus?.id || isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    setLoadError("");

    try {
      const response = await fetch("/api/session/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionStatus.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to finalize session.");
      }

      setSessionStatus((current) =>
        current
          ? {
              ...current,
              finalized: true,
              canFinalize: false,
              totalScore: data.session.totalScore,
            }
          : current,
      );
      setShowComplete(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to finalize session.");
    } finally {
      setIsFinalizing(false);
    }
  }

  function openTask(task: PropertyTask) {
    setSelectedTask(task);
    setScreen("inspection");
  }

  function signOut() {
    setUser(null);
    setSelectedProperty(null);
    setSelectedTask(null);
    setScreen("properties");
  }

  const filteredProperties = useMemo(() => {
    const normalized = propertyQuery.trim().toLowerCase();

    if (!normalized) {
      return properties;
    }

    return properties.filter((property) => property.name.toLowerCase().includes(normalized));
  }, [properties, propertyQuery]);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  if (user.role !== "CLEANER") {
    return <ManagementPortal user={user} onSignOut={signOut} />;
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2f2f7] text-[#1c1c1e]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[860px] flex-col px-4 pb-28 pt-4 sm:px-6 sm:pt-8">
        <AccountBar user={user} onSignOut={signOut} />

        <header className="mb-5 border-b border-black/[0.06] pb-4 sm:mb-7">
          <p className="text-[13px] font-medium leading-5 text-[#6e6e73]">AI Cleaner QC</p>
          <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.022em] text-[#1d1d1f] sm:text-[42px]">
            {screen === "properties" ? "Properties" : screen === "tasks" ? selectedProperty?.name : selectedTask?.taskName}
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-6 text-[#6e6e73]">
            {screen === "properties"
              ? "Choose the property you are cleaning today."
              : screen === "tasks"
                ? "Choose the place you want to inspect and upload a live photo."
                : selectedProperty
                  ? `Inspecting ${selectedTask?.taskName} at ${selectedProperty.name}.`
                  : "Upload a live inspection photo."}
          </p>
        </header>

        {loadState === "error" ? <InlineError message={loadError} /> : null}

        {screen === "properties" ? (
          <PropertyList
            properties={filteredProperties}
            query={propertyQuery}
            loading={loadState === "loading"}
            onQueryChange={setPropertyQuery}
            onOpenProperty={openProperty}
          />
        ) : null}

        {screen === "tasks" && selectedProperty ? (
          <TaskGrid
            property={selectedProperty}
            loading={loadState === "loading"}
            sessionStatus={sessionStatus}
            showComplete={showComplete}
            isFinalizing={isFinalizing}
            onBack={() => setScreen("properties")}
            onOpenTask={openTask}
            onFinalize={finalizeSession}
          />
        ) : null}

        {screen === "inspection" && selectedProperty && selectedTask ? (
          <InspectionForm
            user={user}
            property={selectedProperty}
            task={selectedTask}
            onBack={() => setScreen("tasks")}
            onResolved={async () => {
              await loadSessionStatus(selectedProperty.id);
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizePassword(password);

    if (!sanitizedEmail) {
      setError("Enter your email.");
      return;
    }

    if (!sanitizedPassword) {
      setError("Enter your password.");
      return;
    }

    setError("");
    setIsSigningIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: sanitizedEmail,
          password: sanitizedPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Sign in failed.");
      }

      onLogin(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setIsSigningIn(false);
    }
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
            Use your cleaner, manager, or admin account.
          </p>
        </header>

        <form onSubmit={handleLogin} className="space-y-7">
          <SettingsSection title="Account Access">
            <SettingsRow
              label="Email"
              icon={<UserRound aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            >
              <input
                aria-label="Email"
                value={email}
                onChange={(event) => {
                  setEmail(sanitizeEmail(event.target.value));
                  setError("");
                }}
                placeholder="example@email.com"
                inputMode="email"
                autoComplete="email"
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

function AccountBar({ user, onSignOut }: { user: AppUser; onSignOut: () => void }) {
  return (
    <div className="mb-4 flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f2f2f7] text-[#007aff]">
          <UserRound aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase leading-4 text-[#8e8e93]">{user.role}</p>
          <p className="truncate text-[16px] font-medium leading-5 text-[#1c1c1e]">{user.name}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Sign out"
        onClick={onSignOut}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#007aff] transition hover:bg-[#f2f2f7] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.97]"
      >
        <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}

function ManagementPortal({ user, onSignOut }: { user: AppUser; onSignOut: () => void }) {
  const canEditProperties = user.role === "ADMIN";
  const [tab, setTab] = useState<AdminTab>("properties");
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyCover, setPropertyCover] = useState("");
  const [propertyCoverFile, setPropertyCoverFile] = useState<File | null>(null);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyCoverFile, setNewPropertyCoverFile] = useState<File | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [newTask, setNewTask] = useState<TaskDraft>({ taskName: "", file: null });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppUser["role"]>("CLEANER");
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [cleanerFilter, setCleanerFilter] = useState("");
  const [selectedCleanerName, setSelectedCleanerName] = useState("");
  const [historyPropertyId, setHistoryPropertyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [portalError, setPortalError] = useState("");

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  const loadPortalData = useCallback(
    async (nextSelectedPropertyId = selectedPropertyId) => {
      setIsLoading(true);
      setPortalError("");

      try {
        const params = new URLSearchParams({ role: user.role });
        const requests = [
          fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/admin/history?${params.toString()}`, { cache: "no-store" }),
        ];

        if (canEditProperties) {
          requests.unshift(fetch(`/api/admin/properties?${params.toString()}`, { cache: "no-store" }));
        } else {
          requests.unshift(fetch("/api/properties", { cache: "no-store" }));
        }

        const responses = await Promise.all(requests);
        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failedPayload = payloads.find((payload, index) => !responses[index].ok || !payload.ok);

        if (failedPayload) {
          throw new Error(failedPayload.error ?? "Unable to load management data.");
        }

        let userPayloadIndex = 0;

        const nextProperties = (payloads[0].properties as (AdminProperty | PropertySummary)[]).map((property) => ({
          ...property,
          tasks: "tasks" in property ? property.tasks : [],
        })) as AdminProperty[];
        setProperties(nextProperties);
        userPayloadIndex = 1;

        if (canEditProperties) {
          const nextSelected =
            nextProperties.find((property) => property.id === nextSelectedPropertyId) ?? nextProperties[0] ?? null;
          setSelectedPropertyId(nextSelected?.id ?? "");
          setPropertyName(nextSelected?.name ?? "");
          setPropertyCover(nextSelected?.coverImage ?? "");
          setPropertyCoverFile(null);
          setTaskDrafts(
            Object.fromEntries(
              (nextSelected?.tasks ?? []).map((task) => [
                task.taskName,
                {
                  taskName: task.taskName,
                  file: null,
                },
              ]),
            ),
          );
        }

        setUsers(payloads[userPayloadIndex].users);
        setHistory(payloads[userPayloadIndex + 1].sessions);
      } catch (error) {
        setPortalError(error instanceof Error ? error.message : "Unable to load management data.");
      } finally {
        setIsLoading(false);
      }
    },
    [canEditProperties, selectedPropertyId, user.role],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortalData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPortalData]);

  function selectProperty(property: AdminProperty) {
    setSelectedPropertyId(property.id);
    setPropertyName(property.name);
    setPropertyCover(property.coverImage);
    setPropertyCoverFile(null);
    setHistoryPropertyId(property.id);
    setTaskDrafts(
      Object.fromEntries(
        property.tasks.map((task) => [
          task.taskName,
          {
            taskName: task.taskName,
            file: null,
          },
        ]),
      ),
    );
  }

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPropertyName.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch("/api/admin/properties", {
        method: "POST",
        body: await buildPropertyFormData({
          role: user.role,
          name: newPropertyName.trim(),
          coverFile: newPropertyCoverFile,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to create property.");
      }

      setNewPropertyName("");
      setNewPropertyCoverFile(null);
      await loadPortalData(data.property.id);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to create property.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSelectedProperty() {
    if (!selectedProperty || !propertyName.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch(`/api/admin/properties/${selectedProperty.id}`, {
        method: "PATCH",
        body: await buildPropertyFormData({
          role: user.role,
          name: propertyName.trim(),
          coverFile: propertyCoverFile,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save property.");
      }

      await loadPortalData(selectedProperty.id);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to save property.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelectedProperty() {
    if (!selectedProperty || isSaving || !window.confirm(`Delete ${selectedProperty.name}?`)) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch(`/api/admin/properties/${selectedProperty.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: user.role }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to delete property.");
      }

      await loadPortalData("");
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to delete property.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTask(previousTaskName?: string) {
    if (!selectedProperty || isSaving) {
      return;
    }

    const draft = previousTaskName ? taskDrafts[previousTaskName] : newTask;

    if (!draft?.taskName.trim()) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const formData = new FormData();
      formData.append("role", user.role);
      formData.append("taskName", draft.taskName.trim());

      if (previousTaskName) {
        formData.append("previousTaskName", previousTaskName);
      }

      if (draft.file) {
        formData.append("file", await compressImageFile(draft.file));
      }

      const response = await fetch(`/api/admin/properties/${selectedProperty.id}/tasks`, {
        method: previousTaskName ? "PATCH" : "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save place.");
      }

      setNewTask({ taskName: "", file: null });
      await loadPortalData(selectedProperty.id);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to save place.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTask(taskName: string) {
    if (!selectedProperty || isSaving || !window.confirm(`Delete ${taskName}?`)) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch(`/api/admin/properties/${selectedProperty.id}/tasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: user.role,
          taskName,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to delete place.");
      }

      await loadPortalData(selectedProperty.id);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to delete place.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword || isSaving) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: user.role,
          name: newUserName.trim(),
          email: sanitizeEmail(newUserEmail),
          password: sanitizePassword(newUserPassword),
          userRole: newUserRole,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to create user.");
      }

      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("CLEANER");
      await loadPortalData();
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to create user.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setUserActive(managedUser: ManagedUser, active: boolean) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setPortalError("");

    try {
      const response = await fetch(`/api/admin/users/${managedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: user.role,
          name: managedUser.name,
          email: managedUser.email,
          userRole: managedUser.role,
          active,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update user.");
      }

      await loadPortalData();
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setIsSaving(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const normalized = cleanerFilter.trim().toLowerCase();
    return history.filter((session) => {
      const matchesSearch = !normalized || session.cleanerName.toLowerCase().includes(normalized);
      const matchesCleaner = !selectedCleanerName || session.cleanerName === selectedCleanerName;
      const matchesProperty = !historyPropertyId || session.propertyId === historyPropertyId;
      return matchesSearch && matchesCleaner && matchesProperty;
    });
  }, [cleanerFilter, history, historyPropertyId, selectedCleanerName]);

  return (
    <main className="min-h-[100dvh] bg-[#f2f2f7] text-[#1c1c1e]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1040px] flex-col px-4 pb-24 pt-4 sm:px-6 sm:pt-8">
        <AccountBar user={user} onSignOut={onSignOut} />

        <header className="mb-5 border-b border-black/[0.06] pb-4 sm:mb-7">
          <p className="text-[13px] font-medium leading-5 text-[#6e6e73]">AI Cleaner QC</p>
          <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.022em] text-[#1d1d1f] sm:text-[42px]">
            Management
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-6 text-[#6e6e73]">
            {canEditProperties
              ? "Manage properties, reference places, staff, and human review history."
              : "Manage cleaners and review cleaner session history."}
          </p>
        </header>

        <div className="mb-5 grid rounded-[12px] bg-[#e5e5ea] p-0.5 sm:inline-grid sm:grid-flow-col">
          <PortalTabButton active={tab === "properties"} label="Properties" onClick={() => setTab("properties")} />
          <PortalTabButton active={tab === "cleaners"} label="Cleaners" onClick={() => setTab("cleaners")} />
          <PortalTabButton active={tab === "history"} label="History" onClick={() => setTab("history")} />
        </div>

        {portalError ? <InlineError message={portalError} /> : null}
        {isLoading ? <LoadingPanel label="Loading management data" /> : null}

        {!isLoading && tab === "properties" && canEditProperties ? (
          <PropertiesAdminPanel
            properties={properties}
            selectedProperty={selectedProperty}
            propertyName={propertyName}
            propertyCover={propertyCover}
            propertyCoverFile={propertyCoverFile}
            newPropertyName={newPropertyName}
            newPropertyCoverFile={newPropertyCoverFile}
            taskDrafts={taskDrafts}
            newTask={newTask}
            isSaving={isSaving}
            onCreateProperty={createProperty}
            onSelectProperty={selectProperty}
            onPropertyNameChange={setPropertyName}
            onPropertyCoverFileChange={setPropertyCoverFile}
            onNewPropertyNameChange={setNewPropertyName}
            onNewPropertyCoverFileChange={setNewPropertyCoverFile}
            onSaveProperty={saveSelectedProperty}
            onDeleteProperty={deleteSelectedProperty}
            onTaskDraftChange={(taskName, draft) =>
              setTaskDrafts((current) => ({
                ...current,
                [taskName]: {
                  ...current[taskName],
                  ...draft,
                },
              }))
            }
            onNewTaskChange={(draft) => setNewTask((current) => ({ ...current, ...draft }))}
            onSaveTask={saveTask}
            onDeleteTask={deleteTask}
          />
        ) : null}

        {!isLoading && tab === "properties" && !canEditProperties ? (
          <PropertyHistoryPanel
            properties={properties}
            selectedPropertyId={historyPropertyId}
            history={filteredHistory}
            onSelectProperty={(propertyId) => {
              setHistoryPropertyId(propertyId);
              setSelectedCleanerName("");
              setCleanerFilter("");
            }}
          />
        ) : null}

        {!isLoading && tab === "cleaners" ? (
          <CleanerAdminPanel
            user={user}
            users={users}
            newUserName={newUserName}
            newUserEmail={newUserEmail}
            newUserPassword={newUserPassword}
            newUserRole={newUserRole}
            isSaving={isSaving}
            onCreateUser={createUser}
            onNewUserNameChange={setNewUserName}
            onNewUserEmailChange={setNewUserEmail}
            onNewUserPasswordChange={setNewUserPassword}
            onNewUserRoleChange={setNewUserRole}
            onSetUserActive={setUserActive}
            selectedCleanerName={selectedCleanerName}
            selectedCleanerHistory={filteredHistory}
            onSelectCleaner={(cleanerName) => {
              setSelectedCleanerName(cleanerName);
              setHistoryPropertyId("");
              setCleanerFilter("");
            }}
          />
        ) : null}

        {!isLoading && tab === "history" ? (
          <HistoryAdminPanel
            cleanerFilter={cleanerFilter}
            history={filteredHistory}
            onCleanerFilterChange={setCleanerFilter}
            onClearFilters={() => {
              setSelectedCleanerName("");
              setHistoryPropertyId("");
              setCleanerFilter("");
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

function PortalTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-[10px] px-4 text-[15px] font-semibold transition active:scale-[0.98] ${
        active ? "bg-white text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.14)]" : "text-[#3a3a3c]"
      }`}
    >
      {label}
    </button>
  );
}

function PropertiesAdminPanel({
  properties,
  selectedProperty,
  propertyName,
  propertyCover,
  propertyCoverFile,
  newPropertyName,
  newPropertyCoverFile,
  taskDrafts,
  newTask,
  isSaving,
  onCreateProperty,
  onSelectProperty,
  onPropertyNameChange,
  onPropertyCoverFileChange,
  onNewPropertyNameChange,
  onNewPropertyCoverFileChange,
  onSaveProperty,
  onDeleteProperty,
  onTaskDraftChange,
  onNewTaskChange,
  onSaveTask,
  onDeleteTask,
}: {
  properties: AdminProperty[];
  selectedProperty: AdminProperty | null;
  propertyName: string;
  propertyCover: string;
  propertyCoverFile: File | null;
  newPropertyName: string;
  newPropertyCoverFile: File | null;
  taskDrafts: Record<string, TaskDraft>;
  newTask: TaskDraft;
  isSaving: boolean;
  onCreateProperty: (event: FormEvent<HTMLFormElement>) => void;
  onSelectProperty: (property: AdminProperty) => void;
  onPropertyNameChange: (value: string) => void;
  onPropertyCoverFileChange: (file: File | null) => void;
  onNewPropertyNameChange: (value: string) => void;
  onNewPropertyCoverFileChange: (file: File | null) => void;
  onSaveProperty: () => void;
  onDeleteProperty: () => void;
  onTaskDraftChange: (taskName: string, draft: Partial<TaskDraft>) => void;
  onNewTaskChange: (draft: Partial<TaskDraft>) => void;
  onSaveTask: (previousTaskName?: string) => void;
  onDeleteTask: (taskName: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-5">
        <form onSubmit={onCreateProperty} className="space-y-3">
          <SettingsSection title="New Property">
            <div className="px-4 py-3">
              <input
                aria-label="New property name"
                value={newPropertyName}
                onChange={(event) => onNewPropertyNameChange(event.target.value)}
                placeholder="Property name"
                className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
              />
              <ImageUploadLabel
                label={newPropertyCoverFile ? newPropertyCoverFile.name : "Upload cover image"}
                onFileChange={onNewPropertyCoverFileChange}
              />
            </div>
          </SettingsSection>
          <button
            type="submit"
            disabled={!newPropertyName.trim() || isSaving}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#007aff] px-4 text-[16px] font-semibold text-white transition hover:bg-[#006ee6] active:scale-[0.98] disabled:bg-[#c7c7cc]"
          >
            Add Property
          </button>
        </form>

        <SettingsSection title="Properties">
          {properties.length === 0 ? (
            <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No properties yet.</div>
          ) : (
            properties.map((property, index) => (
              <div key={property.id}>
                {index > 0 ? <RowDivider /> : null}
                <button
                  type="button"
                  onClick={() => onSelectProperty(property)}
                  className={`flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left transition ${
                    selectedProperty?.id === property.id ? "bg-[#f2f2f7]" : "hover:bg-[#fbfbfd]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7] text-[#007aff]">
                    <Building2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium text-[#1c1c1e]">{property.name}</span>
                    <span className="block text-[13px] leading-5 text-[#6e6e73]">{property.taskCount} places</span>
                  </span>
                </button>
              </div>
            ))
          )}
        </SettingsSection>
      </div>

      {selectedProperty ? (
        <div className="space-y-5">
          <SettingsSection title="Property Details">
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)_140px]">
              <div className="aspect-[4/3] overflow-hidden rounded-[12px] bg-[#e5e5ea]">
                {propertyCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={propertyCover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#8e8e93]">
                    <Building2 aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input
                  aria-label="Property name"
                  value={propertyName}
                  onChange={(event) => onPropertyNameChange(event.target.value)}
                  className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
                />
                <ImageUploadLabel
                  label={propertyCoverFile ? propertyCoverFile.name : "Replace cover image"}
                  onFileChange={onPropertyCoverFileChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <button
                  type="button"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  className="min-h-11 rounded-[12px] bg-[#007aff] px-3 text-[15px] font-semibold text-white transition hover:bg-[#006ee6] active:scale-[0.98] disabled:bg-[#c7c7cc]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onDeleteProperty}
                  disabled={isSaving}
                  className="min-h-11 rounded-[12px] bg-[#ff3b30]/10 px-3 text-[15px] font-semibold text-[#b42318] transition hover:bg-[#ff3b30]/15 active:scale-[0.98] disabled:text-[#8e8e93]"
                >
                  Delete
                </button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Add Place">
            <TaskEditRow
              draft={newTask}
              isSaving={isSaving}
              primaryLabel="Add Place"
              onChange={onNewTaskChange}
              onSave={() => onSaveTask()}
            />
          </SettingsSection>

          <SettingsSection title="Places">
            {selectedProperty.tasks.length === 0 ? (
              <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No places yet.</div>
            ) : (
              selectedProperty.tasks.map((task, index) => {
                const draft = taskDrafts[task.taskName] ?? {
                  taskName: task.taskName,
                  file: null,
                };

                return (
                  <div key={task.id}>
                    {index > 0 ? <RowDivider /> : null}
                    <TaskEditRow
                      draft={draft}
                      isSaving={isSaving}
                      referencePreview={task.referenceImageUrl}
                      primaryLabel="Save"
                      onChange={(nextDraft) => onTaskDraftChange(task.taskName, nextDraft)}
                      onSave={() => onSaveTask(task.taskName)}
                      onDelete={() => onDeleteTask(task.taskName)}
                    />
                  </div>
                );
              })
            )}
          </SettingsSection>
        </div>
      ) : (
        <EmptyPanel title="No Property Selected" description="Add or select a property to manage places and images." />
      )}
    </div>
  );
}

function TaskEditRow({
  draft,
  isSaving,
  primaryLabel,
  referencePreview,
  onChange,
  onSave,
  onDelete,
}: {
  draft: TaskDraft;
  isSaving: boolean;
  primaryLabel: string;
  referencePreview?: string;
  onChange: (draft: Partial<TaskDraft>) => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_96px]">
      <div className="aspect-square overflow-hidden rounded-[12px] bg-[#e5e5ea]">
        {referencePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={referencePreview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#8e8e93]">
            <ImageIcon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <input
          aria-label="Place name"
          value={draft.taskName}
          onChange={(event) => onChange({ taskName: event.target.value })}
          placeholder="Place name"
          className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
        />
        <ImageUploadLabel
          label={draft.file ? draft.file.name : referencePreview ? "Replace reference image" : "Upload reference image"}
          onFileChange={(file) => onChange({ file })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !draft.taskName.trim()}
          className="min-h-11 rounded-[12px] bg-[#007aff] px-3 text-[15px] font-semibold text-white transition hover:bg-[#006ee6] active:scale-[0.98] disabled:bg-[#c7c7cc]"
        >
          {primaryLabel}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="min-h-11 rounded-[12px] bg-[#ff3b30]/10 px-3 text-[15px] font-semibold text-[#b42318] transition hover:bg-[#ff3b30]/15 active:scale-[0.98] disabled:text-[#8e8e93]"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ImageUploadLabel({ label, onFileChange }: { label: string; onFileChange: (file: File | null) => void }) {
  return (
    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-black/[0.14] bg-[#f9f9fb] px-3 text-[14px] font-medium text-[#007aff] transition hover:bg-white">
      <Upload aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      <span className="min-w-0 truncate">{label}</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function CleanerAdminPanel({
  user,
  users,
  newUserName,
  newUserEmail,
  newUserPassword,
  newUserRole,
  isSaving,
  onCreateUser,
  onNewUserNameChange,
  onNewUserEmailChange,
  onNewUserPasswordChange,
  onNewUserRoleChange,
  onSetUserActive,
  selectedCleanerName,
  selectedCleanerHistory,
  onSelectCleaner,
}: {
  user: AppUser;
  users: ManagedUser[];
  newUserName: string;
  newUserEmail: string;
  newUserPassword: string;
  newUserRole: AppUser["role"];
  isSaving: boolean;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void;
  onNewUserNameChange: (value: string) => void;
  onNewUserEmailChange: (value: string) => void;
  onNewUserPasswordChange: (value: string) => void;
  onNewUserRoleChange: (role: AppUser["role"]) => void;
  onSetUserActive: (managedUser: ManagedUser, active: boolean) => void;
  selectedCleanerName: string;
  selectedCleanerHistory: HistorySession[];
  onSelectCleaner: (cleanerName: string) => void;
}) {
  if (user.role === "MANAGER") {
    const cleaners = users.filter((managedUser) => managedUser.role === "CLEANER");

    return (
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <SettingsSection title="Cleaners">
          {cleaners.length === 0 ? (
            <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No cleaners found.</div>
          ) : (
            cleaners.map((managedUser, index) => (
              <div key={managedUser.id}>
                {index > 0 ? <RowDivider /> : null}
                <button
                  type="button"
                  onClick={() => onSelectCleaner(managedUser.name)}
                  className={`flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left transition ${
                    selectedCleanerName === managedUser.name ? "bg-[#f2f2f7]" : "hover:bg-[#fbfbfd]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7] text-[#007aff]">
                    <UserRound aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-[#1c1c1e]">{managedUser.name}</span>
                    <span className="block truncate text-[13px] leading-5 text-[#6e6e73]">{managedUser.email}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      managedUser.active ? "bg-[#34c759]/10 text-[#248a3d]" : "bg-[#ff3b30]/10 text-[#b42318]"
                    }`}
                  >
                    {managedUser.active ? "Active" : "Inactive"}
                  </span>
                </button>
              </div>
            ))
          )}
        </SettingsSection>

        <SettingsSection title={selectedCleanerName ? `${selectedCleanerName} History` : "Cleaner History"}>
          {!selectedCleanerName ? (
            <div className="px-4 py-5 text-[14px] text-[#6e6e73]">Select a cleaner to review visits, scores, and failed tasks.</div>
          ) : selectedCleanerHistory.length === 0 ? (
            <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No sessions found for this cleaner yet.</div>
          ) : (
            selectedCleanerHistory.map((session, index) => (
              <HistorySessionCard key={session.id} session={session} showDivider={index > 0} />
            ))
          )}
        </SettingsSection>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={onCreateUser} className="space-y-3">
        <SettingsSection title={user.role === "ADMIN" ? "New User" : "New Cleaner"}>
          <div className="space-y-2 px-4 py-3">
            <input
              aria-label="Name"
              value={newUserName}
              onChange={(event) => onNewUserNameChange(event.target.value)}
              placeholder="Name"
              className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
            />
            <input
              aria-label="Email"
              value={newUserEmail}
              onChange={(event) => onNewUserEmailChange(sanitizeEmail(event.target.value))}
              placeholder="email@example.local"
              inputMode="email"
              className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
            />
            <input
              aria-label="Password"
              type="password"
              value={newUserPassword}
              onChange={(event) => onNewUserPasswordChange(sanitizePassword(event.target.value))}
              placeholder="Temporary password"
              className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#f9f9fb] px-3 text-[16px] outline-none transition placeholder:text-[#8e8e93] focus:border-[#007aff]/40 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
            />
            {user.role === "ADMIN" ? (
              <div className="grid grid-cols-3 rounded-[10px] bg-[#e5e5ea] p-0.5">
                {(["CLEANER", "MANAGER", "ADMIN"] as AppUser["role"][]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onNewUserRoleChange(role)}
                    className={`min-h-9 rounded-[8px] px-2 text-[12px] font-semibold transition ${
                      newUserRole === role ? "bg-white text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.14)]" : "text-[#3a3a3c]"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SettingsSection>
        <button
          type="submit"
          disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword || isSaving}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#007aff] px-4 text-[16px] font-semibold text-white transition hover:bg-[#006ee6] active:scale-[0.98] disabled:bg-[#c7c7cc]"
        >
          Create
        </button>
      </form>

      <SettingsSection title="Accounts">
        {users.length === 0 ? (
          <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No users found.</div>
        ) : (
          users.map((managedUser, index) => (
            <div key={managedUser.id}>
              {index > 0 ? <RowDivider /> : null}
              <div className="flex min-h-[64px] items-center gap-3 px-4 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7] text-[#007aff]">
                  <UserRound aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium text-[#1c1c1e]">{managedUser.name}</p>
                  <p className="truncate text-[13px] leading-5 text-[#6e6e73]">
                    {managedUser.role} · {managedUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSetUserActive(managedUser, !managedUser.active)}
                  disabled={isSaving}
                  className={`min-h-9 rounded-full px-3 text-[13px] font-semibold transition active:scale-[0.98] disabled:bg-[#c7c7cc] ${
                    managedUser.active ? "bg-[#34c759]/10 text-[#248a3d]" : "bg-[#ff3b30]/10 text-[#b42318]"
                  }`}
                >
                  {managedUser.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))
        )}
      </SettingsSection>
    </div>
  );
}

function PropertyHistoryPanel({
  properties,
  selectedPropertyId,
  history,
  onSelectProperty,
}: {
  properties: AdminProperty[];
  selectedPropertyId: string;
  history: HistorySession[];
  onSelectProperty: (propertyId: string) => void;
}) {
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <SettingsSection title="Properties">
        {properties.length === 0 ? (
          <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No properties found.</div>
        ) : (
          properties.map((property, index) => (
            <div key={property.id}>
              {index > 0 ? <RowDivider /> : null}
              <button
                type="button"
                onClick={() => onSelectProperty(property.id)}
                className={`flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left transition ${
                  selectedPropertyId === property.id ? "bg-[#f2f2f7]" : "hover:bg-[#fbfbfd]"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7] text-[#007aff]">
                  <Building2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-medium text-[#1c1c1e]">{property.name}</span>
                  <span className="block text-[13px] leading-5 text-[#6e6e73]">{property.taskCount} places</span>
                </span>
              </button>
            </div>
          ))
        )}
      </SettingsSection>

      <SettingsSection title={selectedProperty ? `${selectedProperty.name} Visits` : "Property Visits"}>
        {!selectedProperty ? (
          <div className="px-4 py-5 text-[14px] text-[#6e6e73]">Select a property to see cleaner visits and scores.</div>
        ) : history.length === 0 ? (
          <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No sessions found for this property yet.</div>
        ) : (
          history.map((session, index) => <HistorySessionCard key={session.id} session={session} showDivider={index > 0} />)
        )}
      </SettingsSection>
    </div>
  );
}

function HistoryAdminPanel({
  cleanerFilter,
  history,
  onCleanerFilterChange,
  onClearFilters,
}: {
  cleanerFilter: string;
  history: HistorySession[];
  onCleanerFilterChange: (value: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e93]"
          strokeWidth={2}
        />
        <input
          aria-label="Filter cleaner history"
          value={cleanerFilter}
          onChange={(event) => onCleanerFilterChange(event.target.value)}
          placeholder="Filter by cleaner"
          className="h-12 w-full rounded-[14px] border border-black/[0.06] bg-white px-12 text-[16px] text-[#1c1c1e] outline-none shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition placeholder:text-[#8e8e93] focus:ring-4 focus:ring-[#007aff]/10"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClearFilters}
          className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-[#007aff] transition hover:bg-white active:scale-[0.98]"
        >
          Clear filters
        </button>
      </div>

      <SettingsSection title="Cleaner History">
        {history.length === 0 ? (
          <div className="px-4 py-5 text-[14px] text-[#6e6e73]">No cleaner sessions yet.</div>
        ) : (
          history.map((session, index) => <HistorySessionCard key={session.id} session={session} showDivider={index > 0} />)
        )}
      </SettingsSection>
    </div>
  );
}

function HistorySessionCard({ session, showDivider }: { session: HistorySession; showDivider: boolean }) {
  return (
    <div>
      {showDivider ? <RowDivider /> : null}
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-6 text-[#1c1c1e]">{session.propertyName}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[#6e6e73]">
              {session.cleanerName} · {formatHistoryDate(session.updatedAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <HistoryPill label={`${session.totalScore}`} tone={session.totalScore >= 90 ? "green" : "red"} />
            <HistoryPill label={session.finalized ? "Final" : "Open"} tone={session.finalized ? "blue" : "gray"} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <ScoreMini label="Tasks" value={session.taskCount} />
          <ScoreMini label="Fails" value={session.failedCount} />
          <ScoreMini label="Appeals" value={session.appealedCount} />
        </div>
        {session.failedTasks.length > 0 ? (
          <div className="mt-3 space-y-2">
            {session.failedTasks.map((task) => (
              <div key={task.taskName} className="rounded-[12px] bg-[#f9f9fb] px-3 py-2">
                <p className="text-[14px] font-semibold text-[#1c1c1e]">{task.taskName}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">{task.aiFeedback || "No AI feedback saved."}</p>
                {task.cleanerNotes ? (
                  <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">Cleaner notes: {task.cleanerNotes}</p>
                ) : null}
                {task.liveImageUrl ? (
                  <a
                    href={task.liveImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-[13px] font-medium text-[#007aff]"
                  >
                    Review image
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PropertyList({
  properties,
  query,
  loading,
  onQueryChange,
  onOpenProperty,
}: {
  properties: PropertySummary[];
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onOpenProperty: (propertyId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e93]"
          strokeWidth={2}
        />
        <input
          aria-label="Search properties"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search properties"
          className="h-12 w-full rounded-[14px] border border-black/[0.06] bg-white px-12 text-[16px] text-[#1c1c1e] outline-none shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition placeholder:text-[#8e8e93] focus:ring-4 focus:ring-[#007aff]/10"
        />
      </div>

      {loading ? <LoadingPanel label="Loading properties" /> : null}

      {!loading && properties.length === 0 ? (
        <EmptyPanel title="No Properties" description="Seeded properties will appear here after MongoDB loads." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((property) => (
          <button
            key={property.id}
            type="button"
            onClick={() => onOpenProperty(property.id)}
            className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-[#fbfbfd] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.99]"
          >
            <div className="aspect-[16/10] bg-[#e5e5ea]">
              {property.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={property.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[#8e8e93]">
                  <Building2 aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="truncate text-[17px] font-semibold leading-6 text-[#1c1c1e]">{property.name}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">{property.taskCount} places to inspect</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskGrid({
  property,
  loading,
  sessionStatus,
  showComplete,
  isFinalizing,
  onBack,
  onOpenTask,
  onFinalize,
}: {
  property: PropertyDetail;
  loading: boolean;
  sessionStatus: SessionStatus | null;
  showComplete: boolean;
  isFinalizing: boolean;
  onBack: () => void;
  onOpenTask: (task: PropertyTask) => void;
  onFinalize: () => void;
}) {
  const taskStatusMap = useMemo(() => {
    return new Map((sessionStatus?.tasks ?? []).map((task) => [task.taskName, task]));
  }, [sessionStatus?.tasks]);

  return (
    <div className="space-y-5">
      <BackButton label="All properties" onClick={onBack} />
      {loading ? <LoadingPanel label="Loading places" /> : null}

      {showComplete && sessionStatus?.finalized ? (
        <SettingsSection title="Job Complete">
          <div className="px-4 py-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#34c759]/10 text-[#248a3d]">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[20px] font-semibold leading-6 text-[#1c1c1e]">Session finalized</p>
                <p className="mt-1 text-[14px] leading-5 text-[#6e6e73]">
                  {property.name} is locked with a final score of {sessionStatus.totalScore}.
                </p>
              </div>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection title="Progress">
        <div className="grid grid-cols-3 divide-x divide-black/[0.08]">
          <ScoreMetric label="Score" value={sessionStatus?.totalScore ?? 100} />
          <ScoreMetric label="Resolved" value={`${sessionStatus?.resolvedCount ?? 0}/${sessionStatus?.taskCount ?? property.tasks.length}`} />
          <ScoreMetric label="State" value={sessionStatus?.finalized ? "Done" : "Open"} />
        </div>
        {sessionStatus?.canFinalize && !sessionStatus.finalized ? (
          <>
            <RowDivider />
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={onFinalize}
                disabled={isFinalizing}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#34c759] px-4 text-[16px] font-semibold text-white transition hover:bg-[#2fb84f] focus:outline-none focus:ring-4 focus:ring-[#34c759]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c7c7cc]"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2} />
                    Finalizing
                  </>
                ) : (
                  <>
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                    Finalize Session
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}
      </SettingsSection>

      <div className="grid gap-3 sm:grid-cols-2">
        {property.tasks.map((task) => {
          const taskStatus = taskStatusMap.get(task.taskName);
          const visualStatus = getTaskVisualStatus(taskStatus);

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task)}
              className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-[#fbfbfd] focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] bg-[#e5e5ea]">
                {task.referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={task.referenceImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#8e8e93]">
                    <ImageIcon aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[12px] font-semibold shadow-[0_8px_18px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md ${visualStatus.className}`}
                >
                  {visualStatus.label}
                </span>
              </div>
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f2f7] text-[#007aff]">
                  <MapPinned aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold leading-6 text-[#1c1c1e]">{task.taskName}</p>
                  <p className="truncate text-[13px] leading-5 text-[#6e6e73]">{visualStatus.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InspectionForm({
  user,
  property,
  task,
  onBack,
  onResolved,
}: {
  user: AppUser;
  property: PropertyDetail;
  task: PropertyTask;
  onBack: () => void;
  onResolved: () => Promise<void>;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [liveImageUrl, setLiveImageUrl] = useState("");
  const [evaluation, setEvaluation] = useState<AiEvaluation | null>(null);
  const [isAppealing, setIsAppealing] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!scheduledAt || photos.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setShowFeedback(false);
    setUploadError("");
    setLiveImageUrl("");
    setEvaluation(null);

    try {
      const compressedFile = await compressImageFile(photos[0].file);
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("cleanerName", user.name);
      formData.append("propertyName", property.name);
      formData.append("taskName", task.taskName);

      const response = await fetch("/api/upload-task", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      const uploadedImageUrl = data.liveImageUrl as string;
      setLiveImageUrl(uploadedImageUrl);

      const evaluationResponse = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          cleanerName: user.name,
          taskName: task.taskName,
          liveImageUrl: uploadedImageUrl,
          referenceImageUrl: task.referenceImageUrl,
          cleanerNotes: notes.trim(),
        }),
      });
      const evaluationData = await evaluationResponse.json();

      if (!evaluationResponse.ok || !evaluationData.ok) {
        throw new Error(evaluationData.error ?? "AI evaluation failed.");
      }

      setEvaluation({
        ...evaluationData.result,
        model: evaluationData.model,
        sessionId: evaluationData.sessionId,
        appealed: false,
      });
      await onResolved();
      setShowFeedback(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppeal() {
    if (!evaluation?.sessionId || !selectedTaskFailed(evaluation) || isAppealing) {
      return;
    }

    setIsAppealing(true);
    setUploadError("");

    try {
      const response = await fetch("/api/evaluate-appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: evaluation.sessionId,
          taskName: task.taskName,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Appeal failed.");
      }

      setEvaluation({
        ...data.result,
        model: data.model,
        sessionId: evaluation.sessionId,
        appealed: true,
        totalScore: data.totalScore,
      });
      await onResolved();
      setShowFeedback(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Appeal failed.");
    } finally {
      setIsAppealing(false);
    }
  }

  return (
    <div className="space-y-5">
      <BackButton label="All places" onClick={onBack} />
      <SettingsSection title="Reference">
        <div className="overflow-hidden rounded-[14px] bg-white">
          <div className="aspect-[16/10] bg-[#e5e5ea]">
            {task.referenceImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={task.referenceImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[#8e8e93]">
                <ImageIcon aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-[17px] font-semibold leading-6 text-[#1c1c1e]">{task.taskName}</p>
            <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">{property.name}</p>
          </div>
        </div>
      </SettingsSection>

      <form onSubmit={handleSubmit} className="space-y-7">
        <SettingsSection title="Clean Configuration">
          <SettingsRow
            label="Submitted At"
            icon={<Clock3 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
          >
            <span className="truncate text-right text-[15px] font-normal text-[#007aff]">
              {formatLocalDateTimeValue(scheduledAt)}
            </span>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Report" footer="The first selected live photo is checked for duplicates before upload.">
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[16px] font-normal text-[#1c1c1e]" htmlFor="notes">
                Notes / Issues
              </label>
              <span className="truncate text-[13px] text-[#8e8e93]">{user.name}</span>
            </div>
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
                <span className="block text-[16px] font-medium text-[#1c1c1e]">Add Live Photo</span>
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

        {uploadError ? <InlineError message={uploadError} /> : null}

        <button
          type="submit"
          disabled={!scheduledAt || photos.length === 0 || isSubmitting}
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
              Upload Live Photo
            </>
          )}
        </button>
      </form>

      {showFeedback ? (
        <div className="fixed inset-x-3 bottom-4 mx-auto max-w-[520px] rounded-[18px] border border-black/[0.06] bg-white/95 p-4 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${
                evaluation?.status === "FAIL" ? "bg-[#ff3b30]/10 text-[#b42318]" : "bg-[#34c759]/10 text-[#248a3d]"
              }`}
            >
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#1c1c1e]">
                {evaluation?.status === "FAIL" ? "Retake needed" : "Inspection passed"}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[#6e6e73]">
                {evaluation?.status === "PASS"
                  ? "AI review passed this place."
                  : evaluation?.feedback || "AI review failed. Retake the photo and submit again."}
              </p>
              {evaluation?.model ? <p className="mt-1 text-[12px] text-[#8e8e93]">Model: {evaluation.model}</p> : null}
              {typeof evaluation?.totalScore === "number" ? (
                <p className="mt-1 text-[12px] text-[#8e8e93]">Score: {evaluation.totalScore}</p>
              ) : null}
              {selectedTaskFailed(evaluation) && !evaluation?.appealed ? (
                <button
                  type="button"
                  onClick={handleAppeal}
                  disabled={isAppealing}
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full bg-[#1c1c1e] px-4 text-[13px] font-semibold text-white transition hover:bg-[#2c2c2e] focus:outline-none focus:ring-4 focus:ring-black/10 active:scale-[0.98] disabled:bg-[#c7c7cc]"
                >
                  {isAppealing ? "Reviewing appeal" : "Appeal"}
                </button>
              ) : null}
              {liveImageUrl ? (
                <a
                  href={liveImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[13px] font-medium text-[#007aff]"
                >
                  View uploaded image
                </a>
              ) : null}
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
    </div>
  );
}

function selectedTaskFailed(evaluation: AiEvaluation | null) {
  return evaluation?.status === "FAIL";
}

function formatHistoryDate(value: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function HistoryPill({ label, tone }: { label: string; tone: "blue" | "green" | "gray" | "red" }) {
  const className =
    tone === "green"
      ? "bg-[#34c759]/10 text-[#248a3d]"
      : tone === "red"
        ? "bg-[#ff3b30]/10 text-[#b42318]"
        : tone === "blue"
          ? "bg-[#007aff]/10 text-[#0057b8]"
          : "bg-[#f2f2f7] text-[#3a3a3c]";

  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${className}`}>{label}</span>;
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] bg-[#f9f9fb] px-3 py-2 text-center">
      <p className="text-[18px] font-semibold leading-6 text-[#1c1c1e]">{value}</p>
      <p className="text-[11px] font-medium uppercase leading-4 text-[#8e8e93]">{label}</p>
    </div>
  );
}

function ScoreMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="text-[24px] font-semibold leading-7 tracking-normal text-[#1c1c1e]">{value}</p>
      <p className="mt-1 text-[12px] font-medium uppercase leading-4 text-[#8e8e93]">{label}</p>
    </div>
  );
}

function getTaskVisualStatus(taskStatus: SessionTaskStatus | undefined) {
  if (!taskStatus || taskStatus.status === "PENDING") {
    return {
      label: "Pending",
      description: "Needs live photo",
      className: "bg-white/90 text-[#3a3a3c]",
    };
  }

  if (taskStatus.status === "PASS") {
    return {
      label: "Pass",
      description: "Resolved inspection",
      className: "bg-[#34c759]/90 text-white",
    };
  }

  if (taskStatus.appealed) {
    return {
      label: "Final Fail",
      description: "Locked after appeal",
      className: "bg-[#ff3b30]/90 text-white",
    };
  }

  return {
    label: "Appeal",
    description: taskStatus.aiFeedback || "Needs final review",
    className: "bg-[#ffcc00]/95 text-[#1c1c1e]",
  };
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-[15px] font-medium text-[#007aff] transition focus:outline-none focus:ring-4 focus:ring-[#007aff]/10 active:scale-[0.98]"
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      {label}
    </button>
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

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[88px] items-center justify-center gap-3 rounded-[14px] border border-black/[0.06] bg-white text-[15px] text-[#6e6e73]">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2} />
      {label}
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5 text-center">
      <p className="text-[17px] font-semibold text-[#1c1c1e]">{title}</p>
      <p className="mt-1 text-[14px] leading-5 text-[#6e6e73]">{description}</p>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mb-5 rounded-[14px] border border-[#ff3b30]/20 bg-[#ff3b30]/10 px-4 py-3 text-[14px] leading-5 text-[#b42318]">
      {message}
    </div>
  );
}
