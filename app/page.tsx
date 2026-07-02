"use client";

import {
  Activity,
  AlertTriangle,
  Barcode,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Flag,
  LockKeyhole,
  LogOut,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserPlus,
  Users,
  Warehouse,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import * as XLSX from "xlsx";

type Role = "counter" | "financier" | "admin";
type MeasureType = "quantity" | "volume" | "weight";
type CountStatus = "pending" | "matching" | "discrepancy" | "locked" | "validated";

type CountMap = Partial<Record<MeasureType, number>>;

type InventoryReference = {
  id: string;
  sku: string;
  name: string;
  aller: string;
  assignedGroup: string;
  required: MeasureType[];
  expected: CountMap;
  unit: Record<MeasureType, string>;
  status: CountStatus;
  attempt: number;
  lastCount?: CountMap;
  secondGroup?: string;
};

type OperatorUser = {
  username: string;
  fullName: string;
  role: Role;
  group: string;
  locked: boolean;
};

type CounterGroup = {
  name: string;
  description: string;
  active: boolean;
};

type AuditEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  ip: string;
  severity: "info" | "warning" | "critical";
};

const initialGroups: CounterGroup[] = [
  { name: "Group A", description: "Primary aisle counting team", active: true },
  { name: "Group B", description: "Secondary warehouse team", active: true },
  { name: "Group C", description: "Overflow and recount team", active: true },
  { name: "Supervisor", description: "Administrative supervision", active: true },
  { name: "Control Room", description: "Finance and reconciliation desk", active: true },
];

function activeGroupNames(groups: CounterGroup[]) {
  return groups.filter((group) => group.active).map((group) => group.name);
}

function counterGroupNames(groups: CounterGroup[]) {
  return activeGroupNames(groups).filter((group) => group.startsWith("Group"));
}

const roleLabels: Record<Role, string> = {
  counter: "Counter",
  financier: "Financier",
  admin: "Admin",
};

const measureLabels: Record<MeasureType, string> = {
  quantity: "Quantity",
  volume: "Volume",
  weight: "Weight",
};

const measureUnits: Record<MeasureType, string> = {
  quantity: "pcs",
  volume: "L",
  weight: "kg",
};

const initialReferences: InventoryReference[] = [
  {
    id: "REF-AX-104",
    sku: "AX104-BOX",
    name: "Valve Control Boxes",
    aller: "ALLER-01",
    assignedGroup: "Group A",
    required: ["quantity"],
    expected: { quantity: 420 },
    unit: measureUnits,
    status: "pending",
    attempt: 0,
  },
  {
    id: "REF-LQ-220",
    sku: "LQ220-DRM",
    name: "Industrial Cleaning Fluid",
    aller: "ALLER-01",
    assignedGroup: "Group A",
    required: ["volume"],
    expected: { volume: 1280 },
    unit: measureUnits,
    status: "pending",
    attempt: 0,
  },
  {
    id: "REF-MT-712",
    sku: "MT712-PAL",
    name: "Copper Wire Pallets",
    aller: "ALLER-02",
    assignedGroup: "Group B",
    required: ["weight"],
    expected: { weight: 815.5 },
    unit: measureUnits,
    status: "pending",
    attempt: 0,
  },
  {
    id: "REF-MX-311",
    sku: "MX311-KIT",
    name: "Maintenance Kit Mixed Case",
    aller: "ALLER-02",
    assignedGroup: "Group C",
    required: ["quantity", "weight"],
    expected: { quantity: 64, weight: 146.2 },
    unit: measureUnits,
    status: "discrepancy",
    attempt: 1,
    lastCount: { quantity: 63, weight: 146.2 },
  },
  {
    id: "REF-PK-908",
    sku: "PK908-SLV",
    name: "Packaging Sleeves",
    aller: "ALLER-03",
    assignedGroup: "Group B",
    required: ["quantity"],
    expected: { quantity: 1200 },
    unit: measureUnits,
    status: "matching",
    attempt: 1,
    lastCount: { quantity: 1200 },
  },
  {
    id: "REF-WT-510",
    sku: "WT510-CAN",
    name: "Coating Compound Canisters",
    aller: "ALLER-03",
    assignedGroup: "Group C",
    required: ["quantity", "volume"],
    expected: { quantity: 48, volume: 960 },
    unit: measureUnits,
    status: "locked",
    attempt: 3,
    lastCount: { quantity: 47, volume: 960 },
  },
];

const initialUsers: OperatorUser[] = [
  { username: "counter", fullName: "Maya Counter", role: "counter", group: "Group A", locked: false },
  { username: "finance", fullName: "Jonas Controller", role: "financier", group: "Control Room", locked: false },
  { username: "admin", fullName: "Cyncro Admin", role: "admin", group: "Supervisor", locked: false },
];

const initialAudit: AuditEntry[] = [
  {
    id: "AUD-0001",
    timestamp: "2026-06-10 07:42",
    user: "admin",
    action: "Inventory day cycle opened",
    ip: "10.14.2.11",
    severity: "info",
  },
  {
    id: "AUD-0002",
    timestamp: "2026-06-10 08:15",
    user: "finance",
    action: "SAP baseline loaded for ALLER-01",
    ip: "10.14.2.18",
    severity: "info",
  },
  {
    id: "AUD-0003",
    timestamp: "2026-06-10 08:51",
    user: "counter",
    action: "REF-WT-510 locked after third failed attempt",
    ip: "10.14.5.42",
    severity: "warning",
  },
];

const statusStyles: Record<
  CountStatus,
  { label: string; chip: string; row: string; dot: string; icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "Pending",
    chip: "border-slate-600 bg-slate-900 text-slate-200",
    row: "border-l-slate-400 bg-slate-50",
    dot: "bg-slate-400",
    icon: Activity,
  },
  matching: {
    label: "Matching",
    chip: "border-emerald-500/70 bg-emerald-950 text-emerald-100",
    row: "border-l-emerald-500 bg-emerald-50",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  discrepancy: {
    label: "Discrepancy",
    chip: "border-red-500/70 bg-red-950 text-red-100",
    row: "border-l-red-500 bg-red-50",
    dot: "bg-red-400",
    icon: XCircle,
  },
  locked: {
    label: "Locked",
    chip: "border-amber-500/80 bg-amber-950 text-amber-100",
    row: "border-l-amber-400 bg-amber-50",
    dot: "bg-amber-300",
    icon: LockKeyhole,
  },
  validated: {
    label: "Validated",
    chip: "border-sky-500/80 bg-sky-950 text-sky-100",
    row: "border-l-sky-500 bg-sky-50",
    dot: "bg-sky-400",
    icon: ClipboardCheck,
  },
};

const inputClass =
  "h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-emerald-400";
const compactInputClass =
  "h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-emerald-400";
const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-emerald-400 bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500";
const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-600 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600";
const dangerButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-red-500/70 bg-red-950 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-900";
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getTimestamp() {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes(),
  )}`;
}

function isMeasureMatch(item: InventoryReference, count: CountMap) {
  return item.required.every((measure) => {
    const expected = item.expected[measure];
    const actual = count[measure];
    if (expected === undefined || actual === undefined || Number.isNaN(actual)) {
      return false;
    }
    return Math.abs(expected - actual) <= 0.01;
  });
}

function formatNumber(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[\s_/-]/g, "");
}

function cellValue(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);
  const foundKey = Object.keys(row).find((key) => normalizedAliases.includes(normalizeKey(key)));
  return foundKey ? row[foundKey] : undefined;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function cloneReference(item: InventoryReference): InventoryReference {
  return {
    ...item,
    required: [...item.required],
    expected: { ...item.expected },
    lastCount: item.lastCount ? { ...item.lastCount } : undefined,
    unit: { ...item.unit },
  };
}

type AppState = {
  users: OperatorUser[];
  references: InventoryReference[];
  audit: AuditEntry[];
  groups: CounterGroup[];
};

const demoStateKey = "cyncro-operational-suite-demo-state-v1";
let volatileDemoState: AppState | undefined;

function cloneState(state: AppState): AppState {
  return {
    users: state.users.map((user) => ({ ...user })),
    references: state.references.map(cloneReference),
    audit: state.audit.map((entry) => ({ ...entry })),
    groups: state.groups.map((group) => ({ ...group })),
  };
}

function createDemoState(): AppState {
  return cloneState({
    users: initialUsers,
    references: initialReferences,
    audit: initialAudit,
    groups: initialGroups,
  });
}

function getDemoStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readDemoState() {
  if (typeof window === "undefined") {
    return createDemoState();
  }

  const storage = getDemoStorage();
  if (!storage) {
    volatileDemoState = volatileDemoState ?? createDemoState();
    return cloneState(volatileDemoState);
  }

  const rawState = storage.getItem(demoStateKey);
  if (rawState) {
    try {
      const parsed = JSON.parse(rawState) as AppState;
      if (Array.isArray(parsed.users) && Array.isArray(parsed.references) && Array.isArray(parsed.audit)) {
        return cloneState({
          ...parsed,
          groups: Array.isArray(parsed.groups) ? parsed.groups : initialGroups,
        });
      }
    } catch {
      storage.removeItem(demoStateKey);
    }
  }

  const state = createDemoState();
  writeDemoState(state);
  return state;
}

function writeDemoState(state: AppState) {
  const nextState = cloneState(state);
  const storage = getDemoStorage();
  if (storage) {
    storage.setItem(demoStateKey, JSON.stringify(nextState));
  } else {
    volatileDemoState = nextState;
  }
  return nextState;
}

function addDemoAudit(
  state: AppState,
  user: string,
  action: string,
  severity: AuditEntry["severity"] = "info",
  ip = "local",
) {
  state.audit.unshift({
    id: `AUD-${Date.now()}-${state.audit.length}`,
    timestamp: getTimestamp(),
    user,
    action,
    ip,
    severity,
  });
}

function requireDemoActor(state: AppState, username: string | undefined, roles: Role[]) {
  if (!username) {
    throw new Error("Missing actor.");
  }
  const actor = state.users.find((user) => user.username === username);
  if (!actor || actor.locked) {
    throw new Error("Actor is missing or locked.");
  }
  if (!roles.includes(actor.role)) {
    throw new Error("Role is not allowed for this action.");
  }
  return actor;
}

function requireDemoReference(state: AppState, referenceId: string | undefined) {
  const id = referenceId?.trim().toUpperCase();
  if (!id) {
    throw new Error("Reference is required.");
  }
  const reference = state.references.find((item) => item.id === id);
  if (!reference) {
    throw new Error("Reference not found.");
  }
  return reference;
}

function apiGetState() {
  return Promise.resolve(readDemoState());
}

async function apiPost<TResponse = { ok: boolean }>(url: string, body: unknown) {
  const state = readDemoState();
  const request = body as Record<string, unknown>;

  if (url === "/api/login") {
    const username = String(request.username ?? "").trim().toLowerCase();
    const password = String(request.password ?? "");
    const user = state.users.find((candidate) => candidate.username === username);
    if (!user || user.locked || password !== "align") {
      throw new Error("Invalid credentials or locked user.");
    }
    addDemoAudit(state, user.username, "Signed in to Cyncro workstation");
    writeDemoState(state);
    return { user } as TResponse;
  }

  if (url === "/api/audit") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["counter", "financier", "admin"]);
    const action = String(request.action ?? "").trim();
    if (!action) {
      throw new Error("Audit action is required.");
    }
    addDemoAudit(state, actor.username, action, (request.severity as AuditEntry["severity"]) ?? "info");
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/counts") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["counter", "admin"]);
    const reference = requireDemoReference(state, request.referenceId as string | undefined);
    if (reference.status === "locked") {
      throw new Error("Reference is locked.");
    }
    if (actor.role === "counter" && reference.assignedGroup !== actor.group) {
      throw new Error("This reference is assigned to another group.");
    }
    const rawCount = (request.count ?? {}) as CountMap;
    const submittedCount: CountMap = {
      quantity: toNumber(rawCount.quantity),
      volume: toNumber(rawCount.volume),
      weight: toNumber(rawCount.weight),
    };
    const missing = reference.required.some((measure) => submittedCount[measure] === undefined);
    if (missing) {
      throw new Error("All required count fields must be submitted.");
    }
    const matched = isMeasureMatch(reference, submittedCount);
    const nextAttempt = matched ? Math.max(reference.attempt, 1) : reference.attempt + 1;
    const nextStatus: CountStatus = matched ? "matching" : nextAttempt >= 3 ? "locked" : "discrepancy";
    reference.lastCount = submittedCount;
    reference.attempt = nextAttempt;
    reference.status = nextStatus;
    addDemoAudit(
      state,
      actor.username,
      `${reference.id} submitted as ${nextStatus} on attempt ${nextAttempt}`,
      nextStatus === "matching" ? "info" : "warning",
    );
    writeDemoState(state);
    return { ok: true, status: nextStatus, attempt: nextAttempt } as TResponse;
  }

  if (url === "/api/finance/validate") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["financier", "admin"]);
    const reference = requireDemoReference(state, request.referenceId as string | undefined);
    reference.status = "validated";
    addDemoAudit(state, actor.username, `${reference.id} validated by finance controller`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/finance/count-again") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["financier", "admin"]);
    const reference = requireDemoReference(state, request.referenceId as string | undefined);
    const nextGroup = counterGroupNames(state.groups).find((group) => group !== reference.assignedGroup) ?? "Group A";
    reference.assignedGroup = nextGroup;
    reference.secondGroup = nextGroup;
    reference.status = "pending";
    reference.attempt = 0;
    reference.lastCount = undefined;
    addDemoAudit(state, actor.username, `${reference.id} reassigned to ${nextGroup} for count again`, "warning");
    writeDemoState(state);
    return { ok: true, nextGroup } as TResponse;
  }

  if (url === "/api/finance/assign-batch") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["financier", "admin"]);
    const aller = String(request.aller ?? "").trim().toUpperCase();
    const group = String(request.group ?? "").trim();
    if (!aller || !group) {
      throw new Error("Aller and assignment group are required.");
    }
    if (!counterGroupNames(state.groups).includes(group)) {
      throw new Error("Assignment group must be a counter group.");
    }
    let updated = 0;
    state.references.forEach((reference) => {
      if (reference.aller === aller) {
        reference.assignedGroup = group;
        updated += 1;
      }
    });
    addDemoAudit(state, actor.username, `${aller} assigned to ${group} by finance`);
    writeDemoState(state);
    return { ok: true, updated } as TResponse;
  }

  if (url === "/api/references/import") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["financier", "admin"]);
    const uploadedReferences = Array.isArray(request.references) ? (request.references as InventoryReference[]) : [];
    if (!uploadedReferences.length) {
      throw new Error("No SAP rows were provided.");
    }
    let imported = 0;
    uploadedReferences.forEach((reference) => {
      const id = reference.id?.trim().toUpperCase();
      if (!id) {
        return;
      }
      const required = reference.required.filter((measure) => measureLabels[measure]);
      const existing = state.references.find((item) => item.id === id);
      const nextReference: InventoryReference = {
        id,
        sku: reference.sku?.trim() || id,
        name: reference.name?.trim() || "SAP Material",
        aller: reference.aller?.trim().toUpperCase() || "ALLER-IMPORT",
        assignedGroup: counterGroupNames(state.groups).includes(reference.assignedGroup?.trim() ?? "")
          ? reference.assignedGroup.trim()
          : "Group A",
        required: required.length ? required : ["quantity"],
        expected: { ...reference.expected },
        unit: measureUnits,
        status: existing?.status ?? "pending",
        attempt: existing?.attempt ?? 0,
        lastCount: existing?.lastCount ? { ...existing.lastCount } : undefined,
        secondGroup: existing?.secondGroup,
      };
      if (existing) {
        Object.assign(existing, nextReference);
      } else {
        state.references.push(nextReference);
      }
      imported += 1;
    });
    addDemoAudit(state, actor.username, `Imported SAP file ${String(request.fileName ?? "upload")} with ${imported} rows`);
    writeDemoState(state);
    return { ok: true, imported } as TResponse;
  }

  if (url === "/api/admin/users") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const user = (request.user ?? {}) as Partial<OperatorUser>;
    const username = user.username?.trim().toLowerCase();
    const fullName = user.fullName?.trim();
    if (!username || !fullName) {
      throw new Error("Username and full name are required.");
    }
    if (state.users.some((item) => item.username === username)) {
      throw new Error("Username already exists.");
    }
    state.users.push({
      username,
      fullName,
      role: user.role ?? "counter",
      group: user.group ?? "Group A",
      locked: false,
    });
    addDemoAudit(state, actor.username, `Added user ${username}`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/admin/groups") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const group = (request.group ?? {}) as Partial<CounterGroup>;
    const name = group.name?.trim();
    if (!name) {
      throw new Error("Group name is required.");
    }
    if (state.groups.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Group already exists.");
    }
    state.groups.push({
      name,
      description: group.description?.trim() || "Operational counter group",
      active: group.active ?? true,
    });
    addDemoAudit(state, actor.username, `Added operational group ${name}`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/admin/references") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const reference = request.reference as InventoryReference | undefined;
    const id = reference?.id?.trim().toUpperCase();
    if (!reference || !id || !reference.name?.trim()) {
      throw new Error("Reference and name are required.");
    }
    if (state.references.some((item) => item.id === id)) {
      throw new Error("Reference already exists.");
    }
    const required = reference.required.filter((measure) => measureLabels[measure]);
    if (!required.length) {
      throw new Error("At least one measure is required.");
    }
    state.references.push({
      id,
      sku: reference.sku?.trim() || id,
      name: reference.name.trim(),
      aller: reference.aller?.trim().toUpperCase() || "ALLER-01",
      assignedGroup: counterGroupNames(state.groups).includes(reference.assignedGroup) ? reference.assignedGroup : "Group A",
      required,
      expected: { ...reference.expected },
      unit: measureUnits,
      status: "pending",
      attempt: 0,
    });
    addDemoAudit(state, actor.username, `Added reference ${id}`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/admin/day-reset") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    state.references.forEach((reference) => {
      reference.status = "pending";
      reference.attempt = 0;
      reference.lastCount = undefined;
      reference.secondGroup = undefined;
    });
    addDemoAudit(state, actor.username, "Day reset completed and temporary locks cleared", "critical");
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  throw new Error(`Unsupported demo action: ${url}`);
}

async function apiPatch<TResponse = { ok: boolean }>(url: string, body: unknown) {
  const state = readDemoState();
  const request = body as Record<string, unknown>;

  if (url === "/api/admin/users") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const username = String(request.username ?? "").trim().toLowerCase();
    const updates = (request.updates ?? {}) as Partial<OperatorUser>;
    const user = state.users.find((item) => item.username === username);
    if (!user) {
      throw new Error("User not found.");
    }
    if (updates.fullName !== undefined) {
      const fullName = updates.fullName.trim();
      if (!fullName) {
        throw new Error("Full name is required.");
      }
      user.fullName = fullName;
    }
    if (updates.role) user.role = updates.role;
    if (updates.group) {
      if (!activeGroupNames(state.groups).includes(updates.group)) {
        throw new Error("User group is not active.");
      }
      user.group = updates.group;
    }
    if (typeof updates.locked === "boolean") user.locked = updates.locked;
    addDemoAudit(state, actor.username, `Updated user ${username}`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/admin/groups") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const name = String(request.name ?? "").trim();
    const updates = (request.updates ?? {}) as Partial<CounterGroup>;
    const group = state.groups.find((item) => item.name === name);
    if (!group) {
      throw new Error("Group not found.");
    }
    if (updates.description !== undefined) {
      group.description = updates.description.trim() || "Operational counter group";
    }
    if (typeof updates.active === "boolean") {
      group.active = updates.active;
    }
    addDemoAudit(state, actor.username, `Updated operational group ${name}`);
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  if (url === "/api/admin/references") {
    const actor = requireDemoActor(state, request.actor as string | undefined, ["admin"]);
    const reference = requireDemoReference(state, request.referenceId as string | undefined);
    const updates = (request.updates ?? {}) as { status?: CountStatus; attempt?: number };
    let changed = false;
    if (updates.status && statusStyles[updates.status]) {
      reference.status = updates.status;
      if (updates.status === "pending") {
        reference.secondGroup = undefined;
      }
      changed = true;
    }
    if (typeof updates.attempt === "number") {
      reference.attempt = Math.max(0, Math.min(3, Math.trunc(updates.attempt)));
      changed = true;
    }
    if (!changed) {
      throw new Error("No reference updates were provided.");
    }
    addDemoAudit(state, actor.username, `Updated reference ${reference.id} from admin override`, "warning");
    writeDemoState(state);
    return { ok: true } as TResponse;
  }

  throw new Error(`Unsupported demo action: ${url}`);
}

export default function CyncroOperationalSuite() {
  const [references, setReferences] = useState<InventoryReference[]>([]);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [groups, setGroups] = useState<CounterGroup[]>(initialGroups);
  const [currentUser, setCurrentUser] = useState<OperatorUser | null>(null);
  const [activeInterface, setActiveInterface] = useState<Role>("counter");
  const [interfaceMenuOpen, setInterfaceMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState("");

  const refreshState = useCallback(async () => {
    const state = await apiGetState();
    setReferences(state.references.map(cloneReference));
    setUsers(state.users);
    setAudit(state.audit);
    setGroups(state.groups);
    return state;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshState()
      .then(() => {
        if (!cancelled) {
          setAppError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAppError(error instanceof Error ? error.message : "Unable to load demo state.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshState]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    const intervalId = window.setInterval(() => {
      refreshState().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [currentUser, refreshState]);

  const appendAudit = (
    user: string,
    action: string,
    severity: AuditEntry["severity"] = "info",
    ip = "10.14.2.24",
  ) => {
    setAudit((previous) => [
      {
        id: `AUD-${Date.now()}`,
        timestamp: getTimestamp(),
        user,
        action,
        ip,
        severity,
      },
      ...previous,
    ]);
    apiPost("/api/audit", { actor: user, action, severity, ip })
      .then(() => refreshState())
      .catch(() => undefined);
  };

  const handleLogin = async (username: string, password: string) => {
    const result = await apiPost<{ user: OperatorUser }>("/api/login", { username, password });
    setCurrentUser(result.user);
    setActiveInterface(result.user.role);
    setInterfaceMenuOpen(false);
    await refreshState();
  };

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} loading={loading} appError={appError} />;
  }

  const metricCounts = references.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pending: 0, matching: 0, discrepancy: 0, locked: 0, validated: 0 } as Record<CountStatus, number>,
  );
  const allowedInterfaces: Role[] =
    currentUser.role === "admin" ? ["counter", "financier", "admin"] : [currentUser.role];

  const switchInterface = (role: Role) => {
    if (!allowedInterfaces.includes(role)) {
      return;
    }
    setActiveInterface(role);
    setInterfaceMenuOpen(false);
    appendAudit(currentUser.username, `Switched interface to ${roleLabels[role]}`);
  };

  const handleLogout = () => {
    appendAudit(currentUser.username, "Signed out of Cyncro workstation");
    setInterfaceMenuOpen(false);
    setActiveInterface("counter");
    setCurrentUser(null);
  };

  if (activeInterface === "counter") {
    return (
      <main className="min-h-screen bg-[#051424] text-slate-100">
        <CounterInterface
          references={references}
          groups={groups}
          currentUser={currentUser}
          appendAudit={appendAudit}
          onRefresh={refreshState}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  if (activeInterface === "financier") {
    return (
      <main className="min-h-screen bg-[#07111e] text-slate-50">
        <FinancierInterface
          references={references}
          groups={groups}
          audit={audit}
          currentUser={currentUser}
          appendAudit={appendAudit}
          onRefresh={refreshState}
          activeInterface={activeInterface}
          allowedInterfaces={allowedInterfaces}
          onSwitchInterface={switchInterface}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-align-void text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5">
          <div className="relative flex items-center gap-4">
            <button
              type="button"
              data-testid="align-logo-menu-trigger"
              className="group flex h-11 items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 text-left transition hover:border-emerald-400"
              onDoubleClick={() => setInterfaceMenuOpen((open) => !open)}
              aria-label="Cyncro interface selector"
              title="Interface selector"
            >
              <span className="grid h-6 w-6 place-items-center rounded bg-emerald-400 text-xs font-black text-slate-950">
                A
              </span>
              <span className="text-sm font-black tracking-normal text-slate-50">Cyncro</span>
            </button>
            {interfaceMenuOpen ? (
              <div className="absolute left-0 top-13 z-40 w-64 rounded border border-slate-700 bg-slate-950 p-2 shadow-terminal">
                {allowedInterfaces.map((role) => (
                  <button
                    key={role}
                    type="button"
                    data-testid={`interface-switch-${role}`}
                    className={cx(
                      "flex h-11 w-full items-center justify-between rounded px-3 text-sm font-semibold transition",
                      activeInterface === role
                        ? "bg-emerald-500 text-slate-950"
                        : "text-slate-200 hover:bg-slate-900 hover:text-emerald-100",
                    )}
                    onClick={() => {
                      switchInterface(role);
                    }}
                  >
                    {roleLabels[role]}
                    <span className="text-xs uppercase tracking-normal">{role}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
              <span className="rounded border border-slate-700 px-2 py-1">Cycle 2026-06-10</span>
              <span className="rounded border border-slate-700 px-2 py-1">PC Workstation</span>
              <span className="rounded border border-emerald-500/60 px-2 py-1 text-emerald-200">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-100">{currentUser.fullName}</p>
              <p className="text-xs text-slate-400">
                {roleLabels[currentUser.role]} / {currentUser.group}
              </p>
            </div>
            <button
              type="button"
              data-testid="logout-button"
              className={iconButtonClass}
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/70 sm:grid-cols-5">
        <StatusMetric label="Pending" value={metricCounts.pending} tone="slate" />
        <StatusMetric label="Matching" value={metricCounts.matching} tone="emerald" />
        <StatusMetric label="Discrepancy" value={metricCounts.discrepancy} tone="red" />
        <StatusMetric label="Locked" value={metricCounts.locked} tone="amber" />
        <StatusMetric label="Validated" value={metricCounts.validated} tone="sky" />
      </section>

      {activeInterface === "admin" ? (
        <AdminInterface
          references={references}
          users={users}
          groups={groups}
          audit={audit}
          currentUser={currentUser}
          appendAudit={appendAudit}
          onRefresh={refreshState}
        />
      ) : null}
    </main>
  );
}

function LoginScreen({
  users,
  onLogin,
  loading,
  appError,
}: {
  users: OperatorUser[];
  onLogin: (username: string, password: string) => Promise<void>;
  loading: boolean;
  appError: string;
}) {
  const [username, setUsername] = useState("counter");
  const [password, setPassword] = useState("align");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    onLogin(username, password).catch((loginError) => {
      setError(loginError instanceof Error ? loginError.message : "Invalid credentials or locked user.");
    });
  };

  return (
    <main className="grid min-h-screen bg-align-void text-slate-50 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="flex min-h-screen flex-col justify-between border-r border-slate-800 bg-slate-950 px-8 py-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-emerald-400 text-base font-black text-slate-950">
            A
          </div>
          <div>
            <p className="text-lg font-black tracking-normal">Cyncro</p>
            <p className="text-xs uppercase tracking-normal text-emerald-200">Operational Suite</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-normal text-emerald-200">
            Inventory Day Workstation
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-normal text-white md:text-6xl">
            Count, reconcile, export.
          </h1>
          <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded border border-slate-800 bg-slate-800">
            <div className="bg-slate-950 p-4">
              <p className="text-3xl font-black text-emerald-300">3</p>
              <p className="mt-1 text-xs text-slate-400">Max attempts</p>
            </div>
            <div className="bg-slate-950 p-4">
              <p className="text-3xl font-black text-sky-300">CSV</p>
              <p className="mt-1 text-xs text-slate-400">SAP import</p>
            </div>
            <div className="bg-slate-950 p-4">
              <p className="text-3xl font-black text-amber-300">XLS</p>
              <p className="mt-1 text-xs text-slate-400">SAP export</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">High contrast interface / WCAG-focused controls / PC optimized</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10">
        <form
          onSubmit={submitLogin}
          className="w-full max-w-md rounded border border-slate-700 bg-slate-950 p-6 shadow-terminal"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-normal text-white">Secure Entry</h2>
              <p className="mt-1 text-sm text-slate-400">Primary interface opens from user role.</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-emerald-300" />
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-normal text-slate-300">Username</span>
            <input
              data-testid="login-username-input"
              className={inputClass}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-normal text-slate-300">Password</span>
            <div className="flex rounded border border-slate-700 bg-slate-950 focus-within:border-emerald-400">
              <input
                data-testid="login-password-input"
                className="h-11 min-w-0 flex-1 rounded bg-transparent px-3 text-sm text-slate-100 outline-none"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                data-testid="login-password-toggle"
                className="grid h-11 w-11 place-items-center text-slate-300 transition hover:text-emerald-200"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error ? (
            <p className="mb-4 rounded border border-red-500/60 bg-red-950 px-3 py-2 text-sm text-red-100">{error}</p>
          ) : null}
          {appError ? (
            <p className="mb-4 rounded border border-amber-500/60 bg-amber-950 px-3 py-2 text-sm text-amber-100">
              {appError}
            </p>
          ) : null}

          <button type="submit" data-testid="login-submit-button" className={primaryButtonClass} disabled={loading}>
            <LockKeyhole className="h-4 w-4" />
            {loading ? "Connecting" : "Enter Workstation"}
          </button>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {users.map((user) => (
              <button
                key={user.username}
                type="button"
                data-testid={`login-demo-${user.role}`}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100"
                onClick={() => {
                  setUsername(user.username);
                  setPassword("align");
                  setError("");
                }}
              >
                {roleLabels[user.role]}
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass: Record<string, string> = {
    slate: "text-slate-200",
    emerald: "text-emerald-300",
    red: "text-red-300",
    amber: "text-amber-300",
    sky: "text-sky-300",
  };
  return (
    <div className="border-r border-slate-800 px-5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className={cx("mt-1 text-2xl font-black tracking-normal", toneClass[tone])}>{value}</p>
    </div>
  );
}

function CounterInterface({
  references,
  groups,
  currentUser,
  appendAudit,
  onRefresh,
  onLogout,
}: {
  references: InventoryReference[];
  groups: CounterGroup[];
  currentUser: OperatorUser;
  appendAudit: (user: string, action: string, severity?: AuditEntry["severity"], ip?: string) => void;
  onRefresh: () => Promise<AppState>;
  onLogout: () => void;
}) {
  const allers = useMemo(() => Array.from(new Set(references.map((item) => item.aller))).sort(), [references]);
  const availableCounterGroups = useMemo(() => counterGroupNames(groups), [groups]);
  const [counterGroup, setCounterGroup] = useState(currentUser.group.startsWith("Group") ? currentUser.group : "Group A");
  const [counterAller, setCounterAller] = useState(allers[0] ?? "ALLER-01");
  const assignedReferences = useMemo(
    () => references.filter((item) => item.assignedGroup === counterGroup && item.aller === counterAller),
    [counterAller, counterGroup, references],
  );
  const [selectedRefId, setSelectedRefId] = useState(assignedReferences[0]?.id ?? references[0]?.id ?? "");
  const selectedReference =
    references.find((item) => item.id === selectedRefId) ?? assignedReferences[0] ?? references[0] ?? null;
  const [scanValue, setScanValue] = useState("");
  const [countInputs, setCountInputs] = useState<Partial<Record<MeasureType, string>>>({});
  const [notice, setNotice] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [counterView, setCounterView] = useState<"count" | "live">("count");

  useEffect(() => {
    if (!availableCounterGroups.includes(counterGroup)) {
      setCounterGroup(availableCounterGroups[0] ?? "Group A");
    }
  }, [availableCounterGroups, counterGroup]);

  useEffect(() => {
    if (!assignedReferences.some((item) => item.id === selectedRefId) && assignedReferences[0]) {
      setSelectedRefId(assignedReferences[0].id);
    }
  }, [assignedReferences, selectedRefId]);

  useEffect(() => {
    if (!selectedReference) {
      return;
    }
    const nextValues: Partial<Record<MeasureType, string>> = {};
    selectedReference.required.forEach((measure) => {
      nextValues[measure] = selectedReference.lastCount?.[measure]?.toString() ?? "";
    });
    setCountInputs(nextValues);
  }, [selectedReference]);

  const completedCount = assignedReferences.filter((item) =>
    ["matching", "validated", "locked"].includes(item.status),
  ).length;
  const progress = assignedReferences.length ? Math.round((completedCount / assignedReferences.length) * 100) : 0;

  const clearCurrentCount = useCallback(() => {
    if (!selectedReference) {
      return;
    }
    const cleared: Partial<Record<MeasureType, string>> = {};
    selectedReference.required.forEach((measure) => {
      cleared[measure] = "";
    });
    setCountInputs(cleared);
    setNotice("");
  }, [selectedReference]);

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-testid="counter-scan-input"]')?.focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearCurrentCount();
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [clearCurrentCount]);

  const lookupReference = () => {
    const query = scanValue.trim().toLowerCase();
    const found = references.find(
      (item) => item.id.toLowerCase() === query || item.sku.toLowerCase() === query || item.name.toLowerCase() === query,
    );
    if (!found) {
      setNotice("Reference not found in SAP baseline.");
      appendAudit(currentUser.username, `Unknown reference lookup: ${scanValue}`, "warning", "10.14.5.42");
      return;
    }
    setCounterGroup(found.assignedGroup);
    setCounterAller(found.aller);
    setSelectedRefId(found.id);
    setNotice(`${found.id} loaded.`);
  };

  const submitCount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReference || selectedReference.status === "locked") {
      return;
    }
    const submittedCount: CountMap = {};
    for (const measure of selectedReference.required) {
      const value = toNumber(countInputs[measure]);
      if (value === undefined) {
        setNotice(`Enter ${measureLabels[measure].toLowerCase()} before submitting.`);
        return;
      }
      submittedCount[measure] = value;
    }

    apiPost<{ ok: boolean; status: CountStatus; attempt: number }>("/api/counts", {
      actor: currentUser.username,
      referenceId: selectedReference.id,
      count: submittedCount,
    })
      .then((result) => {
        setNotice(result.status === "matching" ? "Count accepted." : "Mismatch recorded.");
        return onRefresh();
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : "Count submission failed.");
      });
  };

  if (counterView === "live") {
    return (
      <CounterLiveMonitorInterface
        references={references}
        assignedReferences={assignedReferences}
        currentUser={currentUser}
        counterAller={counterAller}
        progress={progress}
        onBack={() => {
          setCounterView("count");
          appendAudit(currentUser.username, "Returned to counter counting interface");
        }}
        onManualScan={() => {
          setCounterView("count");
          window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="counter-scan-input"]')?.focus(), 0);
        }}
        onPauseBatch={() => appendAudit(currentUser.username, `${counterAller} paused from counter live monitor`, "warning")}
      />
    );
  }

  return (
    <div data-testid="counter-hub-interface" className="h-screen overflow-hidden bg-[#020617] text-[#f8fafc]">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#475569] bg-[#0f172a] px-4 py-3 lg:flex-nowrap lg:px-6 lg:py-0">
        <div className="flex items-center gap-6">
          <span className="text-xl font-black uppercase tracking-normal text-white">Cyncro</span>
          <div className="hidden h-6 w-px bg-[#475569] sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Active Caller</span>
            <span className="font-mono text-sm font-black text-[#10b981]">{counterAller}</span>
          </div>
        </div>

        <div className="w-full max-w-xl lg:px-8">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
              {counterAisle(counterAller)} Progress
            </span>
            <span className="font-mono text-sm font-black text-white">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#334155]">
            <div className="h-full bg-[#10b981] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-[#10b981] md:flex">
            <Activity className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-normal">System Online</span>
          </div>
          <button
            type="button"
            data-testid="counter-live-monitor-button"
            className="hidden h-9 items-center gap-2 rounded border border-[#10b981]/50 bg-[#064e3b]/50 px-3 text-[10px] font-black uppercase tracking-normal text-[#34d399] transition hover:bg-[#065f46] hover:text-white md:inline-flex"
            onClick={() => {
              setCounterView("live");
              appendAudit(currentUser.username, "Opened counter live monitor");
            }}
          >
            <Activity className="h-3.5 w-3.5" />
            Live Monitor
          </button>
          <div className="text-right">
            <p className="text-sm font-black text-white">{currentUser.fullName}</p>
            <p className="text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
              Group: {currentUser.group.replace("Group ", "")}
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded border border-[#475569] bg-[#1e293b] text-xs font-black text-white">
            {currentUser.fullName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <button
            type="button"
            data-testid="counter-notifications-button"
            className="grid h-10 w-10 place-items-center rounded text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
            onClick={() => appendAudit(currentUser.username, "Checked counter notifications")}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-testid="counter-settings-button"
            className="grid h-10 w-10 place-items-center rounded text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
            onClick={() => appendAudit(currentUser.username, "Opened counter settings")}
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden lg:flex-row">
        <aside className="flex h-[250px] w-full shrink-0 flex-col border-b border-[#475569] bg-[#0f172a] lg:h-auto lg:w-64 lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                data-testid="counter-scan-input"
                className="h-10 w-full rounded border border-[#475569] bg-[#020617] py-2 pl-10 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-[#64748b] focus:border-[#10b981]"
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    lookupReference();
                  }
                }}
                placeholder="Scan or Search Ref..."
              />
            </div>
            <div className="hidden">
              <select
                data-testid="counter-group-select"
                value={counterGroup}
                onChange={(event) => setCounterGroup(event.target.value)}
              >
                {availableCounterGroups.map((group) => (
                    <option key={group}>{group}</option>
                  ))}
              </select>
              <select
                data-testid="counter-aller-select"
                value={counterAller}
                onChange={(event) => setCounterAller(event.target.value)}
              >
                {allers.map((aller) => (
                  <option key={aller}>{aller}</option>
                ))}
              </select>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 py-2 lg:overflow-x-hidden lg:overflow-y-auto">
            <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
              Assigned Items ({counterAisle(counterAller)})
            </p>
            <div className="flex gap-2 lg:block lg:space-y-2">
              {assignedReferences.map((item) => {
                const isActive = selectedReference?.id === item.id;
                const StatusIcon = statusStyles[item.status].icon;
                const isComplete = item.status === "matching" || item.status === "validated";
                return (
                  <button
                    type="button"
                    key={item.id}
                    data-testid={`counter-reference-${item.id}`}
                    className={cx(
                      "min-w-[184px] rounded-r px-3 py-3 text-left transition active:scale-[0.98] lg:w-full lg:min-w-0",
                      isActive
                        ? "border-l-4 border-[#10b981] bg-[#1e293b] text-white"
                        : isComplete
                          ? "text-[#64748b] hover:bg-[#1e293b]"
                          : "text-[#f8fafc] hover:bg-[#1e293b]",
                    )}
                    onClick={() => setSelectedRefId(item.id)}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-black">{item.id}</span>
                      {isActive ? (
                        <span className="rounded bg-[#10b981] px-1.5 py-0.5 text-[10px] font-black text-[#020617]">ACTIVE</span>
                      ) : (
                        <StatusIcon className={cx("h-3.5 w-3.5", isComplete ? "text-[#10b981]" : "text-[#94a3b8]")} />
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 truncate text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
                      {isComplete ? "Completed" : `Bin: ${counterBin(item)}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex gap-2 border-t border-[#475569] p-4 lg:block lg:space-y-2">
            <button
              type="button"
              data-testid="counter-support-button"
              className="flex h-10 w-full items-center gap-3 rounded px-3 text-[10px] font-black uppercase tracking-normal text-[#94a3b8] transition hover:bg-[#1e293b] hover:text-white"
              onClick={() => appendAudit(currentUser.username, "Opened counter support")}
            >
              <AlertTriangle className="h-4 w-4" />
              Support
            </button>
            <button
              type="button"
              data-testid="logout-button"
              className="flex h-10 w-full items-center gap-3 rounded px-3 text-[10px] font-black uppercase tracking-normal text-[#94a3b8] transition hover:bg-[#1e293b] hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#020617] p-4 pb-20 sm:p-6 lg:p-12">
          {selectedReference ? (
            <div className="mx-auto max-w-5xl space-y-6">
              <section className="flex flex-col justify-between gap-5 rounded border border-[#475569] bg-[#0f172a] p-5 sm:p-6 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black text-white">{selectedReference.name}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <span className="rounded border border-[#475569] bg-[#334155] px-3 py-1 font-mono text-[10px] font-black uppercase tracking-normal text-white">
                      ID: {selectedReference.id}
                    </span>
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
                      <MapPin className="h-4 w-4" />
                      Bin {counterBin(selectedReference)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-3 rounded border border-[#475569] px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Manual Override</span>
                    <input
                      data-testid="counter-manual-override-toggle"
                      type="checkbox"
                      className="h-4 w-4 accent-[#10b981]"
                      checked={manualOverride}
                      onChange={(event) => {
                        setManualOverride(event.target.checked);
                        appendAudit(
                          currentUser.username,
                          `${selectedReference.id} manual override ${event.target.checked ? "enabled" : "disabled"}`,
                          event.target.checked ? "warning" : "info",
                        );
                      }}
                    />
                  </label>
                  <div className="text-right">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Attempt Status</p>
                    <div className="flex justify-end gap-1">
                      {[0, 1, 2].map((index) => (
                        <div
                          key={index}
                          className={cx(
                            "h-2 w-8 rounded-full",
                            index < selectedReference.attempt ? "bg-[#10b981]" : "bg-[#334155]",
                          )}
                        />
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-sm font-black text-white">
                      {selectedReference.attempt} OF 3 ATTEMPTS
                    </p>
                  </div>
                </div>
              </section>

              <form onSubmit={submitCount} className="grid grid-cols-12 gap-6">
                <section className="col-span-12 space-y-6 xl:col-span-8">
                  <div className="rounded border border-[#475569] bg-[#0f172a] p-5 sm:p-8">
                    <div className="grid gap-6 sm:grid-cols-2">
                      {(["quantity", "weight"] as MeasureType[]).map((measure) => (
                        <CounterMeasureInput
                          key={measure}
                          measure={measure}
                          selectedReference={selectedReference}
                          value={countInputs[measure] ?? ""}
                          onChange={(value) => setCountInputs((previous) => ({ ...previous, [measure]: value }))}
                        />
                      ))}
                      <div className="sm:col-span-2">
                        <CounterMeasureInput
                          measure="volume"
                          selectedReference={selectedReference}
                          value={countInputs.volume ?? ""}
                          onChange={(value) => setCountInputs((previous) => ({ ...previous, volume: value }))}
                          compact
                        />
                      </div>
                    </div>
                  </div>

                  {notice ? (
                    <p className="rounded border border-[#475569] bg-[#0f172a] px-4 py-3 text-sm font-semibold text-[#f8fafc]">
                      {notice}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-4 sm:flex-row">
                    <button
                      type="button"
                      data-testid="counter-flag-mismatch-button"
                      className="flex min-h-16 flex-1 items-center justify-center gap-3 rounded border border-[#475569] bg-[#0f172a] px-6 text-sm font-black text-white transition hover:bg-[#1e293b]"
                      onClick={() => {
                        setNotice("Mismatch flagged for controller review.");
                        appendAudit(currentUser.username, `${selectedReference.id} flagged manually by counter`, "warning");
                      }}
                    >
                      <Flag className="h-5 w-5 text-[#ef4444]" />
                      FLAG MISMATCH
                    </button>
                    <button
                      type="submit"
                      data-testid="counter-submit-count-button"
                      className="flex min-h-16 flex-[2] items-center justify-center gap-3 rounded bg-[#10b981] px-6 text-lg font-black text-[#020617] shadow-lg transition hover:bg-[#34d399] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-[#94a3b8]"
                      disabled={selectedReference.status === "locked"}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      SUBMIT COUNT
                    </button>
                  </div>
                </section>

                <aside className="col-span-12 space-y-6 xl:col-span-4">
                  <section className="overflow-hidden rounded border border-[#475569] bg-[#0f172a]">
                    <div className="flex items-center justify-between border-b border-[#475569] bg-[#1e293b] px-4 py-3">
                      <span className="text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Reference Image</span>
                      <button
                        type="button"
                        data-testid="counter-reference-docs-button"
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-normal text-[#10b981] transition hover:text-[#34d399]"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Docs
                      </button>
                    </div>
                    <div className="relative aspect-square overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#334155_0%,#15231f_38%,#020617_75%)]">
                      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,.18),transparent_35%),repeating-linear-gradient(160deg,rgba(255,255,255,.06)_0,rgba(255,255,255,.06)_1px,transparent_1px,transparent_4px)]" />
                      <div className="absolute left-1/2 top-1/2 h-[38%] w-[58%] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-[50%] border-[22px] border-[#a9b7b3] bg-[#020617] shadow-[0_18px_32px_rgba(0,0,0,.6),inset_0_0_18px_rgba(255,255,255,.35)]">
                        <div className="absolute inset-4 rounded-[50%] bg-[#020617] shadow-[inset_0_0_16px_rgba(0,0,0,.85)]" />
                        <div className="absolute -left-4 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[#64748b] bg-[#020617]" />
                        <div className="absolute -right-4 top-8 h-5 w-5 rounded-full border-2 border-[#64748b] bg-[#020617]" />
                      </div>
                      <div className="absolute bottom-2 right-2 rounded border border-[#475569] bg-[#0f172a]/90 px-2 py-1 text-[10px] font-black text-white">
                        ENLARGE (F4)
                      </div>
                    </div>
                  </section>

                  <section className="rounded border border-[#475569] bg-[#0f172a] p-5">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Expected Count</p>
                      <p className="font-mono text-xl font-black text-[#94a3b8]">-- HIDDEN --</p>
                      <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">
                        Blind count mode active. Perform physical check twice if discrepancy exists.
                      </p>
                    </div>
                    <div className="my-5 h-px bg-[#475569]" />
                    <div>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Product Specs</p>
                      <ul className="space-y-3 text-sm text-[#94a3b8]">
                        <li className="flex justify-between gap-3 border-b border-[#475569]/40 pb-2">
                          <span>Material</span>
                          <span className="truncate text-right font-black text-white">{counterMaterial(selectedReference)}</span>
                        </li>
                        <li className="flex justify-between gap-3 border-b border-[#475569]/40 pb-2">
                          <span>Thickness</span>
                          <span className="text-right font-black text-white">{counterThickness(selectedReference)}</span>
                        </li>
                        <li className="flex justify-between gap-3">
                          <span>Weight/Unit</span>
                          <span className="text-right font-black text-white">{counterWeightPerUnit(selectedReference)}</span>
                        </li>
                      </ul>
                    </div>
                  </section>
                </aside>
              </form>

              <section className="rounded border border-[#475569] bg-[#0f172a] p-4">
                <h3 className="mb-4 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">Scan History</h3>
                <div className="space-y-2 font-mono text-[13px]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#475569]/40 py-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-[#10b981]">{financeTimestamp(0)}</span>
                      <span className="text-white">BIN SCAN: {counterBin(selectedReference)}</span>
                    </div>
                    <span className="font-black text-[#4ade80]">VERIFIED</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-[#475569]/40 py-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-[#10b981]">{financeTimestamp(1)}</span>
                      <span className="text-white">ITEM SCAN: {selectedReference.id}</span>
                    </div>
                    <span className="font-black text-[#4ade80]">MATCHED</span>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="max-w-[1180px] rounded border border-amber-400/40 bg-amber-950/30 px-4 py-3 text-sm font-semibold text-amber-100">
              No references assigned to this group and aller.
            </div>
          )}

          <div className="fixed bottom-6 right-6 hidden gap-4 text-[11px] font-black text-[#94a3b8] md:flex">
            <ShortcutHint keyName="ENTER" label="SUBMIT" />
            <ShortcutHint keyName="ESC" label="CANCEL" />
            <ShortcutHint keyName="F2" label="SCAN BARCODE" />
          </div>
        </main>
      </div>
    </div>
  );
}

function CounterLiveMonitorInterface({
  references,
  assignedReferences,
  currentUser,
  counterAller,
  progress,
  onBack,
  onManualScan,
  onPauseBatch,
}: {
  references: InventoryReference[];
  assignedReferences: InventoryReference[];
  currentUser: OperatorUser;
  counterAller: string;
  progress: number;
  onBack: () => void;
  onManualScan: () => void;
  onPauseBatch: () => void;
}) {
  const monitorReferences = assignedReferences.length ? assignedReferences : references;
  const completedCount = monitorReferences.filter((item) => item.status === "matching" || item.status === "validated").length;
  const alertCount = monitorReferences.filter((item) => item.status === "discrepancy" || item.status === "locked").length;
  const toCount = monitorReferences.filter((item) => item.status === "pending" || item.status === "discrepancy").length;
  const totalUnits = monitorReferences.reduce((sum, item) => sum + (financePrimaryValue(item, "expected") ?? 0), 0);
  const scannedUnits = monitorReferences.reduce((sum, item) => sum + (financePrimaryValue(item, "lastCount") ?? 0), 0);
  const estimatedMinutes = Math.max(4, Math.ceil(Math.max(toCount, 1) * 2.5));
  const ringOffset = 282.7 - (Math.max(0, Math.min(100, progress)) / 100) * 282.7;
  const activityRows = monitorReferences.slice(0, 6);

  return (
    <div data-testid="counter-live-monitor-interface" className="flex h-screen overflow-hidden bg-[#020617] text-white">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[#374151] bg-[#1c1c1c] p-6 lg:flex">
        <div className="mb-8">
          <h3 className="mb-4 border-b border-[#475569] pb-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#848484]">
            Reference Panel
          </h3>
          <div className="space-y-6">
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#848484]">Active Batch</p>
              <p className="font-mono text-2xl font-black text-[#10b981]">{counterAller}</p>
            </div>
            <div className="space-y-4">
              <CounterLiveSideMetric label="Total Items" value={formatNumber(totalUnits || monitorReferences.length)} />
              <CounterLiveSideMetric
                label="Units Scanned"
                value={`${formatNumber(scannedUnits || completedCount)}/${formatNumber(totalUnits || monitorReferences.length)}`}
              />
              <CounterLiveSideMetric label="Est. Time Remaining" value={`${estimatedMinutes}m`} accent />
            </div>
            <div className="space-y-4 border-t border-[#475569] pt-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#848484]">Quick Actions</h4>
              <button
                type="button"
                data-testid="counter-live-manual-scan-button"
                className="flex h-12 w-full items-center justify-center gap-2 rounded bg-[#10b981] px-4 text-base font-black text-[#020617] transition hover:bg-[#34d399]"
                onClick={onManualScan}
              >
                <Barcode className="h-5 w-5" />
                Manual Scan
              </button>
              <button
                type="button"
                data-testid="counter-live-pause-batch-button"
                className="flex h-12 w-full items-center justify-center gap-2 rounded border border-[#7e7576] bg-transparent px-4 text-base font-semibold text-white transition hover:bg-[#1e293b]"
                onClick={onPauseBatch}
              >
                <RefreshCcw className="h-5 w-5" />
                Pause Batch
              </button>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-[#475569] pt-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-[#0f172a] text-xs font-black text-[#10b981]">
              {currentUser.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#10b981]">Warehouse Alpha</h2>
              <p className="text-[10px] uppercase text-[#848484]">{currentUser.fullName}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-[#374151] pb-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-5xl font-black leading-none text-white sm:text-6xl">Live Monitor</h1>
            <p className="mt-3 text-lg font-medium text-[#94a3b8]">Real-time telemetry and audit verification.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded border border-[#4ade80] bg-[#4ade80]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#4ade80]">
              <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
              System Nominal
            </span>
            <span className="font-mono text-sm text-[#94a3b8]">{financeTimestamp(0)} UTC</span>
            <button
              type="button"
              data-testid="counter-live-monitor-back-button"
              className="inline-flex h-9 items-center justify-center rounded border border-[#475569] px-3 text-[10px] font-black uppercase tracking-normal text-white transition hover:border-[#10b981] hover:text-[#10b981]"
              onClick={onBack}
            >
              Back to Count
            </button>
          </div>
        </header>

        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <CounterLiveMetric label="Total Items" value={formatNumber(totalUnits || monitorReferences.length)} />
          <CounterLiveMetric label="Alerts Found" value={alertCount.toString()} tone="warning" />
          <CounterLiveMetric label="To Count" value={toCount.toString()} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <section className="flex min-h-[360px] flex-col items-center justify-center rounded border border-[#374151] bg-[#0f172a] p-6">
            <h3 className="mb-auto w-full border-b border-[#374151] pb-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">
              Batch Completion
            </h3>
            <div className="relative my-8 flex h-48 w-48 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="none" r="45" stroke="#1e293b" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  fill="none"
                  r="45"
                  stroke="#10b981"
                  strokeDasharray="282.7"
                  strokeDashoffset={ringOffset}
                  strokeWidth="10"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-black text-white">
                  {progress}<span className="text-2xl">%</span>
                </span>
              </div>
            </div>
            <p className="mt-auto text-center text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">
              Est. Time Remaining: {estimatedMinutes}m
            </p>
          </section>

          <section className="rounded border border-[#374151] bg-[#0f172a] xl:col-span-2">
            <div className="flex items-center justify-between border-b border-[#374151] p-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">Recent Activity Log</h3>
              <Filter className="h-4 w-4 text-[#10b981]" />
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#374151] text-[10px] uppercase tracking-[0.15em] text-[#94a3b8]">
                    <th className="p-4">Reference ID</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-right">Qty</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {activityRows.map((item, index) => {
                    const isAlert = item.status === "discrepancy" || item.status === "locked";
                    const qty = financePrimaryValue(item, "lastCount") ?? financePrimaryValue(item, "expected") ?? 0;
                    return (
                      <tr
                        key={item.id}
                        className={cx(
                          "border-b border-[#1e293b] transition hover:bg-[#1e293b]",
                          isAlert && "border-l-4 border-l-[#fbbf24] bg-[#332514]",
                        )}
                      >
                        <td className={cx("p-4 font-black", isAlert ? "text-[#fbbf24]" : "text-white")}>{item.id}</td>
                        <td className="p-4 text-[#94a3b8]">{financeLocation(item).replace("Aisle", "SEC")}</td>
                        <td className={cx("p-4 text-right font-black", isAlert ? "text-[#fbbf24]" : "text-white")}>
                          {formatNumber(qty)}
                          {isAlert && item.lastCount ? (
                            <span className="ml-1 text-[10px] font-semibold text-[#94a3b8]">
                              ({financeDifference(item)})
                            </span>
                          ) : null}
                        </td>
                        <td className="p-4 text-center">
                          {isAlert ? (
                            <AlertTriangle className="mx-auto h-4 w-4 text-[#fbbf24]" />
                          ) : (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-[#10b981]" />
                          )}
                        </td>
                        <td className="p-4 text-right text-[#94a3b8]">{financeTimestamp(index)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function CounterLiveSideMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#848484]">{label}</p>
      <p className={cx("text-2xl font-black", accent ? "text-[#10b981]" : "text-white")}>{value}</p>
    </div>
  );
}

function CounterLiveMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className={cx("relative overflow-hidden rounded border border-[#374151] bg-[#0f172a] p-6 shadow-2xl", tone === "warning" && "border-[#fbbf24]/50")}>
      {tone === "warning" ? <div className="absolute right-0 top-0 h-full w-2 bg-[#fbbf24]" /> : null}
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">{label}</p>
      <p className={cx("text-6xl font-black", tone === "warning" ? "text-[#fbbf24]" : "text-white")}>{value}</p>
    </div>
  );
}

function CounterMeasureInput({
  measure,
  selectedReference,
  value,
  onChange,
  compact = false,
}: {
  measure: MeasureType;
  selectedReference: InventoryReference;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const required = selectedReference.required.includes(measure);
  const label =
    measure === "quantity"
      ? "Physical Quantity"
      : measure === "weight"
        ? "Unit Weight"
        : "Batch Volume Offset (If Applicable)";
  const disabled = !required || selectedReference.status === "locked";
  const placeholder = measure === "weight" ? "0.00" : "0";
  const unit = selectedReference.unit[measure].toUpperCase();

  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#94a3b8]">{label}</span>
      <div className="relative">
        <input
          data-testid={`counter-count-${measure}-input`}
          className={cx(
            "w-full rounded border border-[#475569] bg-[#020617] font-mono text-white shadow-inner outline-none transition placeholder:text-[#94a3b8] hover:border-[#10b981] focus:border-[#10b981] disabled:cursor-not-allowed disabled:text-[#64748b]",
            compact
              ? "h-20 px-6 pr-16 text-left text-3xl"
              : "h-40 px-6 pr-16 text-center text-6xl",
          )}
          type="number"
          step={measure === "quantity" ? "1" : "0.01"}
          min="0"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <span className="pointer-events-none absolute bottom-4 right-4 rounded border border-[#475569] bg-[#0f172a] px-2 py-1 text-[10px] font-black uppercase tracking-normal text-[#94a3b8]">
          {unit}
        </span>
      </div>
    </label>
  );
}

function ShortcutHint({ keyName, label }: { keyName: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-[#475569] bg-[#0f172a] px-2 py-1.5">
      <kbd className="rounded bg-[#334155] px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-white">
        {keyName}
      </kbd>
      {label}
    </span>
  );
}

function counterBin(item: InventoryReference) {
  const checksum = Array.from(item.id).reduce((total, character) => total + character.charCodeAt(0), 0);
  const zone = item.assignedGroup.replace("Group ", "") || "A";
  return `${zone}-${(checksum % 15) + 1}-${String.fromCharCode(65 + (checksum % 4))}`;
}

function counterAisle(aller: string) {
  const numericPart = Number(aller.replace(/\D/g, ""));
  const aisle = Number.isFinite(numericPart) && numericPart > 0 ? ((numericPart - 1) % 8) + 1 : 1;
  return `Aisle ${aisle}`;
}

function counterMaterial(item: InventoryReference) {
  if (item.required.includes("volume")) {
    return "Liquid / Containerized";
  }
  if (item.required.includes("weight")) {
    return "Bulk Industrial";
  }
  return "Counted Unit";
}

function counterThickness(item: InventoryReference) {
  const checksum = Array.from(item.sku).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `${((checksum % 32) / 10 + 1.6).toFixed(1)}mm`;
}

function counterWeightPerUnit(item: InventoryReference) {
  if (item.expected.weight) {
    return `${(item.expected.weight / Math.max(item.expected.quantity ?? 100, 1)).toFixed(2)}kg`;
  }
  const checksum = Array.from(item.id).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `${((checksum % 38) / 100 + 0.08).toFixed(2)}kg`;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: CountStatus }) {
  const StatusIcon = statusStyles[status].icon;
  return (
    <span className={cx("inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-black", statusStyles[status].chip)}>
      <StatusIcon className="h-4 w-4" />
      {statusStyles[status].label}
    </span>
  );
}

function FinancierInterface({
  references,
  groups,
  audit,
  currentUser,
  appendAudit,
  onRefresh,
  activeInterface,
  allowedInterfaces,
  onSwitchInterface,
  onLogout,
}: {
  references: InventoryReference[];
  groups: CounterGroup[];
  audit: AuditEntry[];
  currentUser: OperatorUser;
  appendAudit: (user: string, action: string, severity?: AuditEntry["severity"], ip?: string) => void;
  onRefresh: () => Promise<AppState>;
  activeInterface: Role;
  allowedInterfaces: Role[];
  onSwitchInterface: (role: Role) => void;
  onLogout: () => void;
}) {
  const allers = useMemo(() => ["ALL", ...Array.from(new Set(references.map((item) => item.aller))).sort()], [references]);
  const financeCounterGroups = useMemo(() => counterGroupNames(groups), [groups]);
  const [selectedAller, setSelectedAller] = useState("ALL");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(financeCounterGroups);
  const [statusFilter, setStatusFilter] = useState<CountStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [importNotice, setImportNotice] = useState("Ready for Processing");
  const [activeLedgerFile, setActiveLedgerFile] = useState("SAP_EXPORT_Q3.csv");
  const [financeView, setFinanceView] = useState<"dashboard" | "batch" | "audit">("dashboard");
  const [batchAssignments, setBatchAssignments] = useState<Record<string, string>>({});
  const [batchNotice, setBatchNotice] = useState("Assignments ready.");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState<CountStatus | "all" | "warning">("all");

  useEffect(() => {
    setSelectedGroups((previous) => {
      const next = previous.filter((group) => financeCounterGroups.includes(group));
      return next.length ? next : financeCounterGroups;
    });
  }, [financeCounterGroups]);

  const visibleReferences = useMemo(
    () =>
      references.filter((item) => {
        const allerMatches = selectedAller === "ALL" || item.aller === selectedAller;
        const groupMatches = selectedGroups.includes(item.assignedGroup) || Boolean(item.secondGroup && selectedGroups.includes(item.secondGroup));
        const statusMatches = statusFilter === "all" || item.status === statusFilter;
        const query = searchQuery.trim().toLowerCase();
        const searchMatches =
          !query ||
          item.id.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          item.aller.toLowerCase().includes(query) ||
          item.assignedGroup.toLowerCase().includes(query);
        return allerMatches && groupMatches && statusMatches && searchMatches;
      }),
    [references, searchQuery, selectedAller, selectedGroups, statusFilter],
  );

  const discrepancyRefs = visibleReferences.filter((item) => item.status === "discrepancy" || item.status === "locked");
  const readyForExport = visibleReferences.filter((item) => item.status === "matching" || item.status === "validated");
  const allerCards = useMemo(
    () =>
      Array.from(new Set(references.map((item) => item.aller)))
        .sort()
        .map((aller) => {
          const batchItems = references.filter((item) => item.aller === aller);
          const doneCount = batchItems.filter((item) => item.status === "matching" || item.status === "validated").length;
          const issueCount = batchItems.filter((item) => item.status === "discrepancy" || item.status === "locked").length;
          return {
            aller,
            references: batchItems.length,
            donePercent: batchItems.length ? Math.round((doneCount / batchItems.length) * 100) : 0,
            issuePercent: batchItems.length ? Math.round((issueCount / batchItems.length) * 100) : 0,
          };
        }),
    [references],
  );
  const batchRows = useMemo(
    () =>
      Array.from(new Set(references.map((item) => item.aller)))
        .sort()
        .map((aller) => {
          const batchItems = references.filter((item) => item.aller === aller);
          const groups = Array.from(new Set(batchItems.map((item) => item.assignedGroup))).filter(Boolean);
          const selectedGroup = batchAssignments[aller] ?? (groups.length === 1 ? groups[0] : "");
          const units = batchItems.reduce((sum, item) => sum + (financePrimaryValue(item, "expected") ?? 0), 0);
          const issueCount = batchItems.filter((item) => item.status === "discrepancy" || item.status === "locked").length;
          return {
            aller,
            references: batchItems.length,
            units,
            selectedGroup,
            status: selectedGroup ? "Ready" : "Pending",
            priority: issueCount > 0 ? "High" : batchItems.length <= 2 ? "Low" : "Standard",
          };
        }),
    [batchAssignments, references],
  );
  const auditRows = useMemo(
    () =>
      visibleReferences.filter((item) => {
        const query = auditSearchQuery.trim().toLowerCase();
        const queryMatches =
          !query ||
          item.id.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          financeLocation(item).toLowerCase().includes(query);
        const statusMatches =
          auditStatusFilter === "all" ||
          (auditStatusFilter === "warning"
            ? item.status === "discrepancy" || item.status === "locked"
            : item.status === auditStatusFilter);
        return queryMatches && statusMatches;
      }),
    [auditSearchQuery, auditStatusFilter, visibleReferences],
  );

  useEffect(() => {
    setBatchAssignments((previous) => {
      const next = { ...previous };
      Array.from(new Set(references.map((item) => item.aller))).forEach((aller) => {
        if (next[aller] !== undefined) {
          return;
        }
        const groups = Array.from(
          new Set(references.filter((item) => item.aller === aller).map((item) => item.assignedGroup)),
        ).filter(Boolean);
        next[aller] = groups.length === 1 ? groups[0] : "";
      });
      return next;
    });
  }, [references]);

  const toggleGroup = (group: string) => {
    setSelectedGroups((previous) =>
      previous.includes(group) ? previous.filter((selected) => selected !== group) : [...previous, group],
    );
  };

  const processFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const importedReferences = rows
        .map((row) => {
          const id = String(cellValue(row, ["reference", "ref", "id", "material", "materialcode"]) ?? "").trim();
          if (!id) {
            return null;
          }
          const sku = String(cellValue(row, ["sku", "barcode", "ean"]) ?? id).trim();
          const name = String(cellValue(row, ["name", "description", "materialdescription"]) ?? "SAP Material").trim();
          const aller = String(cellValue(row, ["aller", "batch", "controlgroup"]) ?? "ALLER-IMPORT").trim();
          const assignedGroup = String(cellValue(row, ["group", "countergroup", "assignedgroup"]) ?? "Group A").trim();
          const expected: CountMap = {};
          (["quantity", "volume", "weight"] as MeasureType[]).forEach((measure) => {
            const value = toNumber(cellValue(row, [measure, `expected${measure}`, `sap${measure}`]));
            if (value !== undefined) {
              expected[measure] = value;
            }
          });
          const required = (Object.keys(expected) as MeasureType[]).length
            ? (Object.keys(expected) as MeasureType[])
            : (["quantity"] as MeasureType[]);
          if (!Object.keys(expected).length) {
            expected.quantity = 0;
          }
          return {
            id,
            sku,
            name,
            aller,
            assignedGroup: financeCounterGroups.includes(assignedGroup) ? assignedGroup : "Group A",
            required,
            expected,
            unit: measureUnits,
            status: "pending" as CountStatus,
            attempt: 0,
          };
        })
        .filter((item): item is InventoryReference => Boolean(item));

      const result = await apiPost<{ ok: boolean; imported: number }>("/api/references/import", {
        actor: currentUser.username,
        fileName: file.name,
        references: importedReferences,
      });
      await onRefresh();
      setActiveLedgerFile(file.name);
      setImportNotice(`${result.imported} SAP rows loaded from ${file.name}.`);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "File import failed. Check SAP column names.");
      appendAudit(currentUser.username, `Failed SAP import for ${file.name}`, "warning");
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const validateReference = (id: string) => {
    apiPost("/api/finance/validate", { actor: currentUser.username, referenceId: id })
      .then(() => onRefresh())
      .catch((error) => setImportNotice(error instanceof Error ? error.message : "Validation failed."));
  };

  const countAgain = (id: string) => {
    apiPost("/api/finance/count-again", { actor: currentUser.username, referenceId: id })
      .then(() => onRefresh())
      .catch((error) => setImportNotice(error instanceof Error ? error.message : "Count-again assignment failed."));
  };

  const finalizeAssignments = async () => {
    try {
      const assignments = batchRows.filter((row) => row.selectedGroup);
      if (!assignments.length) {
        setBatchNotice("Select at least one counter group before finalizing.");
        return;
      }
      const results = await Promise.all(
        assignments.map((row) =>
          apiPost<{ ok: boolean; updated: number }>("/api/finance/assign-batch", {
            actor: currentUser.username,
            aller: row.aller,
            group: row.selectedGroup,
          }),
        ),
      );
      const updated = results.reduce((sum, result) => sum + result.updated, 0);
      setBatchNotice(`${updated} references assigned across ${assignments.length} allers.`);
      await onRefresh();
    } catch (error) {
      setBatchNotice(error instanceof Error ? error.message : "Batch assignment failed.");
    }
  };

  const exportSapFile = () => {
    const exportRows = visibleReferences.map((item) => ({
      Reference: item.id,
      SKU: item.sku,
      Description: item.name,
      Aller: item.aller,
      Group: item.assignedGroup,
      Status: statusStyles[item.status].label,
      SAP_Quantity: item.expected.quantity ?? "",
      Count_Quantity: item.lastCount?.quantity ?? "",
      SAP_Volume: item.expected.volume ?? "",
      Count_Volume: item.lastCount?.volume ?? "",
      SAP_Weight: item.expected.weight ?? "",
      Count_Weight: item.lastCount?.weight ?? "",
      Attempts: item.attempt,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cyncro SAP Export");
    XLSX.writeFile(workbook, `CYNCRO_SAP_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`);
    appendAudit(currentUser.username, `Exported ${exportRows.length} rows for SAP`);
  };
  const confirmedReferences = visibleReferences.filter((item) => item.status === "matching" || item.status === "validated");
  const auditDelta = financeAuditDelta(visibleReferences);

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-200">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
        <div className="flex h-full items-center gap-8">
          <button
            type="button"
            data-testid="finance-align-switch-button"
            className="text-xl font-black uppercase tracking-normal text-white"
            onDoubleClick={() => {
              if (allowedInterfaces.includes("admin")) {
                onSwitchInterface("admin");
              }
            }}
            title="Double-click for admin interface"
          >
            Cyncro
          </button>
          <nav className="hidden h-full items-center gap-6 text-sm font-semibold md:flex">
            <button
              type="button"
              data-testid="finance-dashboard-tab"
              className={cx(
                "flex h-full items-center border-b-2 px-1 transition",
                financeView === "dashboard"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              )}
              onClick={() => setFinanceView("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              data-testid="finance-create-group-button"
              className={cx(
                "flex h-full items-center border-b-2 px-1 transition",
                financeView === "batch"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              )}
              onClick={() => {
                setFinanceView("batch");
                appendAudit(currentUser.username, "Opened financier batch assignment");
              }}
            >
              Batch Assignment
            </button>
            <button
              type="button"
              data-testid="finance-audit-log-tab"
              className={cx(
                "flex h-full items-center border-b-2 px-1 transition",
                financeView === "audit"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              )}
              onClick={() => {
                setFinanceView("audit");
                appendAudit(currentUser.username, "Opened financier audit log");
              }}
            >
              Audit Log
            </button>
            <button
              type="button"
              data-testid="finance-settings-tab"
              className="flex h-full items-center border-b-2 border-transparent px-1 text-slate-400 transition hover:text-slate-200"
              onClick={() => appendAudit(currentUser.username, "Opened financier settings")}
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-slate-400">
            <button
              type="button"
              data-testid="finance-alerts-button"
              className="relative grid h-8 w-8 place-items-center transition hover:text-white"
              onClick={() => appendAudit(currentUser.username, "Checked financier alerts")}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-slate-950 bg-emerald-500" />
            </button>
            <button
              type="button"
              data-testid="finance-refresh-button"
              className="grid h-8 w-8 place-items-center transition hover:text-white"
              onClick={() => onRefresh()}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <button
            type="button"
            data-testid="logout-button"
            className="flex items-center gap-3 rounded px-2 py-1 transition hover:bg-slate-900"
            onClick={onLogout}
            title="Logout"
          >
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-bold leading-tight text-white">{currentUser.fullName}</span>
              <span className="block text-[10px] font-black uppercase tracking-normal text-slate-500">
                Financier Controller
              </span>
            </span>
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400">
              {currentUser.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
          </button>
        </div>
      </header>

      {financeView === "dashboard" ? (
      <main className="flex h-[calc(100vh-56px)] min-h-0 flex-col overflow-hidden md:flex-row">
        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-slate-800 bg-slate-950 p-6 md:w-[320px] md:border-b-0 md:border-r lg:w-[360px]">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold tracking-normal text-white">Financier Overview</h1>
            <p className="text-sm text-slate-400">Manage reconciliation states and finalize SAP batch exports.</p>
            <div className="mt-4 flex items-center gap-2 rounded border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-400">System Online - Sync Active</span>
            </div>
          </div>

          <section className="mb-6 flex flex-col gap-5 rounded border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 text-slate-300">
              <FileSpreadsheet className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold uppercase tracking-normal">Active Ledger File</h2>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-normal text-slate-500">
                Target Export File
              </span>
              <div className="truncate font-mono text-sm font-semibold text-emerald-400">{activeLedgerFile}</div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-slate-300">{importNotice}</span>
            </div>
            <label
              data-testid="financier-dropzone"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cx(
                "flex h-10 cursor-pointer items-center justify-center gap-2 rounded border text-sm font-semibold transition",
                dragActive
                  ? "border-emerald-500 bg-emerald-950 text-emerald-200"
                  : "border-slate-700 bg-slate-800 text-emerald-400 hover:bg-slate-700",
              )}
            >
              <input
                data-testid="financier-file-input"
                className="sr-only"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />
              <CloudUpload className="h-4 w-4" />
              Upload SAP File
            </label>
            <button
              type="button"
              data-testid="financier-export-button"
              className="flex h-10 items-center justify-center gap-2 rounded border border-emerald-500 bg-emerald-600 text-sm font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.1)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              onClick={exportSapFile}
              disabled={!visibleReferences.length}
            >
              <Download className="h-4 w-4" />
              Export Final SAP File
            </button>
          </section>

          <section className="mb-6 rounded border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-normal text-slate-500">Batch Scope</span>
              <span className="text-xs font-bold text-slate-400">{selectedAller}</span>
            </div>
            <div className="grid gap-2">
              {allerCards.map((card) => (
                <button
                  key={card.aller}
                  type="button"
                  data-testid={`finance-aller-card-${card.aller}`}
                  className={cx(
                    "rounded border px-3 py-2 text-left transition",
                    selectedAller === card.aller
                      ? "border-emerald-500 bg-emerald-950/30"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700",
                  )}
                  onClick={() => setSelectedAller(card.aller)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-slate-200">{card.aller}</span>
                    <span className={cx("text-[10px] font-black", card.issuePercent > 0 ? "text-amber-400" : "text-emerald-400")}>
                      {card.issuePercent > 0 ? `${card.issuePercent}% FLAGGED` : `${card.donePercent}% DONE`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-800">
                    <div
                      className={cx("h-full", card.issuePercent > 0 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${Math.max(card.issuePercent, card.donePercent)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-800 pt-4">
            <FinanceKpi label="Total SKUs" value={references.length.toString()} tone="slate" />
            <FinanceKpi label="Audit Delta" value={auditDelta} tone="amber" />
            <FinanceKpi label="Confirmed" value={confirmedReferences.length.toString()} tone="emerald" />
            <FinanceKpi label="Flagged" value={discrepancyRefs.length.toString()} tone="rose" />
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950 p-6">
          <div className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Reconciliation Activity</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Showing {visibleReferences.length} of {references.length} inventory events
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  data-testid="finance-search-input"
                  className="h-9 w-full rounded border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search SKU or Location..."
                />
              </div>
              <select
                data-testid="financier-aller-select"
                className="h-9 rounded border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-300 outline-none transition hover:bg-slate-800 focus:border-emerald-500"
                value={selectedAller}
                onChange={(event) => setSelectedAller(event.target.value)}
              >
                {allers.map((aller) => (
                  <option key={aller}>{aller}</option>
                ))}
              </select>
              <select
                data-testid="financier-status-select"
                className="h-9 rounded border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-300 outline-none transition hover:bg-slate-800 focus:border-emerald-500"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CountStatus | "all")}
              >
                <option value="all">Filter</option>
                <option value="pending">Pending</option>
                <option value="matching">Confirmed</option>
                <option value="discrepancy">Flagged</option>
                <option value="locked">Override</option>
                <option value="validated">Validated</option>
              </select>
              <button
                type="button"
                data-testid="finance-csv-button"
                className="flex h-9 items-center gap-2 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                onClick={exportSapFile}
                disabled={!visibleReferences.length}
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>

          <div className="hidden flex-wrap gap-2 border-b border-slate-800 pb-3">
            {financeCounterGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  data-testid={`financier-group-checkbox-${group.replace(/\s+/g, "-").toLowerCase()}`}
                  className={cx(
                    "h-8 rounded px-3 text-xs font-black transition",
                    selectedGroups.includes(group)
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-900 text-slate-400 ring-1 ring-slate-700 hover:text-white",
                  )}
                  onClick={() => toggleGroup(group)}
                >
                  {group}
                </button>
              ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-700 bg-slate-900">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="relative min-w-[980px] w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b border-slate-700 bg-slate-950">
                  <tr>
                    <th className="w-10 px-4 py-2.5 text-[11px] font-black uppercase tracking-normal text-slate-400" />
                    <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-normal text-slate-400">SKU ID</th>
                    <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-normal text-slate-400">Location</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-normal text-slate-400">Sys Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-normal text-slate-400">Audit Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-normal text-slate-400">Var</th>
                    <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-normal text-slate-400">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-normal text-slate-400">Timestamp</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-normal text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {visibleReferences.map((item, index) => {
                    const StatusIcon = financeStatusIcon(item.status);
                    return (
                      <tr key={item.id} className={cx("group transition hover:bg-slate-800/50", financeRowClass(item.status))}>
                        <td className={cx("px-4 py-2", financeAccentClass(item.status))}>
                          <StatusIcon className={cx("h-[18px] w-[18px]", financeIconClass(item.status))} />
                        </td>
                        <td className="px-4 py-2 font-mono font-semibold text-slate-200">
                          <p>{item.sku}</p>
                          <p className="mt-1 text-[10px] font-bold text-slate-500">{item.id}</p>
                        </td>
                        <td className="px-4 py-2 text-slate-400">{financeLocation(item)}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">{financeSystemQuantity(item)}</td>
                        <td className={cx("px-4 py-2 text-right font-mono", item.lastCount ? "text-slate-300" : "text-slate-600")}>
                          {financeAuditQuantity(item)}
                        </td>
                        <td className={cx("px-4 py-2 text-right font-mono font-bold", financeDifferenceClass(item))}>
                          {financeDifference(item)}
                        </td>
                        <td className="px-4 py-2">
                          <FinanceStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">{financeTimestamp(index)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              data-testid={`financier-validate-${item.id}`}
                              className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
                              onClick={() => validateReference(item.id)}
                              disabled={item.status === "pending"}
                              aria-label={`Validate ${item.id}`}
                              title="Validate"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              data-testid={`financier-count-again-${item.id}`}
                              className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-amber-300"
                              onClick={() => countAgain(item.id)}
                              aria-label={`Count again ${item.id}`}
                              title="Request re-count"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="flex shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              <div>
                Showing 1-{visibleReferences.length} of {references.length} events
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  data-testid="finance-page-prev"
                  className="grid h-7 w-7 place-items-center rounded border border-slate-700 bg-slate-900 text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <span className="text-sm">{"<"}</span>
                </button>
                <button
                  type="button"
                  data-testid="finance-page-next"
                  className="grid h-7 w-7 place-items-center rounded border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800"
                  onClick={() => appendAudit(currentUser.username, "Paged financier reconciliation table")}
                  aria-label="Next page"
                  title="Next page"
                >
                  <span className="text-sm">{">"}</span>
                </button>
              </div>
            </footer>
          </div>
        </section>
      </main>
      ) : financeView === "batch" ? (
        <FinanceBatchAssignmentView
          batchRows={batchRows}
          batchNotice={batchNotice}
          activeLedgerFile={activeLedgerFile}
          groupOptions={financeCounterGroups}
          onAssignmentChange={(aller, group) => setBatchAssignments((previous) => ({ ...previous, [aller]: group }))}
          onFinalize={finalizeAssignments}
          onUploadClick={() => document.querySelector<HTMLInputElement>('[data-testid="financier-file-input"]')?.click()}
        />
      ) : (
        <FinanceAuditLogView
          references={auditRows}
          audit={audit}
          auditSearchQuery={auditSearchQuery}
          auditStatusFilter={auditStatusFilter}
          totalReferences={references.length}
          onSearchChange={setAuditSearchQuery}
          onStatusChange={setAuditStatusFilter}
          onExport={exportSapFile}
          onRefresh={() => onRefresh()}
          onValidate={validateReference}
          onCountAgain={countAgain}
        />
      )}
    </div>
  );
}

function FinanceBatchAssignmentView({
  batchRows,
  batchNotice,
  activeLedgerFile,
  groupOptions,
  onAssignmentChange,
  onFinalize,
  onUploadClick,
}: {
  batchRows: Array<{
    aller: string;
    references: number;
    units: number;
    selectedGroup: string;
    status: string;
    priority: string;
  }>;
  batchNotice: string;
  activeLedgerFile: string;
  groupOptions: string[];
  onAssignmentChange: (aller: string, group: string) => void;
  onFinalize: () => void;
  onUploadClick: () => void;
}) {
  const totalSkus = batchRows.reduce((sum, row) => sum + row.references, 0);
  const totalUnits = batchRows.reduce((sum, row) => sum + row.units, 0);
  const unassigned = batchRows.filter((row) => !row.selectedGroup).length;

  return (
    <main className="h-[calc(100vh-56px)] overflow-y-auto bg-[#030816] px-9 py-7 text-slate-200">
      <section className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black text-white">Les Allers: Batch Assignment</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Assign extracted inventory batches to warehouse groups. File{" "}
              <span className="font-black text-slate-200">{activeLedgerFile}</span> processed successfully.
            </p>
            <p data-testid="finance-batch-notice" className="mt-1 text-xs font-semibold text-emerald-400">
              {batchNotice}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="finance-batch-filter-button"
              className="flex h-11 items-center gap-2 rounded border border-slate-700 bg-slate-900 px-5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              onClick={onUploadClick}
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button
              type="button"
              data-testid="finance-finalize-assignments-button"
              className="h-11 rounded bg-emerald-500 px-6 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
              onClick={onFinalize}
            >
              Finalize Assignments
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <FinanceAssignmentMetric label="Total Batches" value={batchRows.length.toString()} />
          <FinanceAssignmentMetric label="Total SKUs" value={formatNumber(totalSkus)} />
          <FinanceAssignmentMetric label="Total Units" value={formatNumber(totalUnits)} />
          <FinanceAssignmentMetric label="Unassigned" value={unassigned.toString()} warning />
        </div>

        <section className="overflow-hidden rounded border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="border-b border-slate-800 bg-[#0b1222] text-[11px] uppercase tracking-normal text-slate-400">
                <tr>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Batch ID</th>
                  <th className="px-5 py-4 text-right">SKUs</th>
                  <th className="px-5 py-4 text-right">Units</th>
                  <th className="px-5 py-4">Priority</th>
                  <th className="px-5 py-4">Assignment Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {batchRows.map((row) => (
                  <tr key={row.aller} className="bg-slate-900/70 transition hover:bg-slate-800/60">
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 text-xs font-black">
                        <span className={cx("h-2.5 w-2.5 rounded-full", row.selectedGroup ? "bg-emerald-500" : "bg-amber-500")} />
                        <span className={row.selectedGroup ? "text-emerald-400" : "text-amber-400"}>{row.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black text-white">{row.aller}</td>
                    <td className="px-5 py-4 text-right font-mono text-slate-300">{formatNumber(row.references)}</td>
                    <td className="px-5 py-4 text-right font-mono text-slate-400">{formatNumber(row.units)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cx(
                          "rounded border px-2 py-1 text-[10px] font-black",
                          row.priority === "High"
                            ? "border-red-500/40 bg-red-950/40 text-red-300"
                            : row.priority === "Low"
                              ? "border-slate-600 bg-slate-800 text-slate-300"
                              : "border-slate-600 bg-slate-800 text-slate-200",
                        )}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="relative max-w-xs">
                        <select
                          data-testid={`finance-batch-group-${row.aller}`}
                          className={cx(
                            "h-10 w-full rounded border bg-[#050a17] px-3 text-sm text-white outline-none transition focus:border-emerald-500",
                            row.selectedGroup ? "border-slate-700" : "border-amber-500 text-amber-200",
                          )}
                          value={row.selectedGroup}
                          onChange={(event) => onAssignmentChange(row.aller, event.target.value)}
                        >
                          <option value="">Select Group...</option>
                          {groupOptions.map((group) => (
                            <option key={group}>{group}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function FinanceAssignmentMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div
      className={cx(
        "rounded border bg-slate-900 p-5",
        warning ? "border-amber-500 text-amber-400" : "border-slate-800 text-white",
      )}
    >
      <p className={cx("mb-3 text-[10px] font-black uppercase tracking-normal", warning ? "text-amber-400" : "text-slate-500")}>
        {label}
      </p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function FinanceAuditLogView({
  references,
  audit,
  auditSearchQuery,
  auditStatusFilter,
  totalReferences,
  onSearchChange,
  onStatusChange,
  onExport,
  onRefresh,
  onValidate,
  onCountAgain,
}: {
  references: InventoryReference[];
  audit: AuditEntry[];
  auditSearchQuery: string;
  auditStatusFilter: CountStatus | "all" | "warning";
  totalReferences: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CountStatus | "all" | "warning") => void;
  onExport: () => void;
  onRefresh: () => void;
  onValidate: (id: string) => void;
  onCountAgain: (id: string) => void;
}) {
  const discrepancies = references.filter((item) => item.status === "discrepancy").length;
  const locks = references.filter((item) => item.status === "locked").length;
  const recounts = references.filter((item) => item.status === "pending" && item.attempt > 0).length;
  const activeCycle = audit[0]?.timestamp?.slice(0, 10) ?? "CYC-2023-Q4-02";

  return (
    <main className="flex h-[calc(100vh-56px)] min-h-0 overflow-hidden bg-[#0a0f18] text-slate-200">
      <aside className="hidden w-[216px] shrink-0 border-r border-slate-800 bg-[#050916] p-5 md:block">
        <p className="mb-5 text-[11px] font-black uppercase tracking-normal text-slate-500">Contextual Info</p>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Active Cycle</p>
            <p className="mt-1 font-black text-white">{activeCycle}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total SKU Count</p>
            <p className="mt-1 font-black text-white">{formatNumber(totalReferences)}</p>
          </div>
        </div>
        <div className="my-6 h-px bg-slate-800" />
        <p className="mb-4 text-[11px] font-black uppercase tracking-normal text-slate-500">System Status</p>
        <div className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          SAP Sync: Active
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black text-white">Audit Log</h1>
            <p className="mt-2 text-sm text-slate-400">Reconciliation and discrepancy management for controlled stock.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="finance-audit-export-button"
              className="flex h-9 items-center gap-2 rounded border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              onClick={onExport}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              data-testid="finance-audit-sync-button"
              className="flex h-9 items-center gap-2 rounded bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500"
              onClick={onRefresh}
            >
              <RefreshCcw className="h-4 w-4" />
              Sync SAP
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <FinanceAuditMetric label="Total Discrepancies" value={discrepancies.toString()} icon={AlertTriangle} tone="amber" />
          <FinanceAuditMetric label="Active Locks" value={locks.toString()} icon={LockKeyhole} tone="slate" />
          <FinanceAuditMetric label="Pending Re-counts" value={recounts.toString()} icon={RefreshCcw} tone="emerald" />
        </div>

        <section className="overflow-hidden rounded border border-slate-800 bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-3 sm:flex-row">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                data-testid="finance-audit-search-input"
                className="h-9 w-full rounded border border-slate-700 bg-[#080d19] pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                value={auditSearchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search SKU or Location..."
              />
            </div>
            <div className="flex gap-2">
              <select
                data-testid="finance-audit-status-select"
                className="h-9 rounded border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-300 outline-none"
                value={auditStatusFilter}
                onChange={(event) => onStatusChange(event.target.value as CountStatus | "all" | "warning")}
              >
                <option value="all">All Logs</option>
                <option value="warning">Discrepancy</option>
                <option value="locked">Locked</option>
                <option value="pending">Pending</option>
                <option value="matching">Matching</option>
                <option value="validated">Validated</option>
              </select>
              <button
                type="button"
                data-testid="finance-audit-filter-button"
                className="flex h-9 items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-300"
                onClick={() => onStatusChange("warning")}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="border-b border-slate-800 bg-[#080d19] text-[11px] uppercase tracking-normal text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SKU ID</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Counter</th>
                  <th className="px-4 py-3 text-right">SAP Qty</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {references.map((item) => (
                  <tr key={item.id} className={cx("transition hover:bg-slate-800/60", financeRowClass(item.status))}>
                    <td className="px-4 py-3">
                      <FinanceStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-200">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-400">{financeLocation(item)}</td>
                    <td className="px-4 py-3 text-slate-400">{item.assignedGroup}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{financeSystemQuantity(item)}</td>
                    <td className={cx("px-4 py-3 text-right font-mono", item.lastCount ? "text-slate-300" : "text-slate-600")}>
                      {financeAuditQuantity(item)}
                    </td>
                    <td className={cx("px-4 py-3 text-right font-mono font-bold", financeDifferenceClass(item))}>
                      {financeDifference(item)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          data-testid={`finance-audit-validate-${item.id}`}
                          className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-emerald-300 disabled:opacity-35"
                          onClick={() => onValidate(item.id)}
                          disabled={item.status === "pending"}
                          aria-label={`Validate ${item.id}`}
                          title="Validate"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`finance-audit-count-again-${item.id}`}
                          className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-amber-300"
                          onClick={() => onCountAgain(item.id)}
                          aria-label={`Count again ${item.id}`}
                          title="Request re-count"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
            Showing 1-{references.length} of {totalReferences} entries. Latest event: {audit[0]?.action ?? "No audit events yet."}
          </footer>
        </section>

        <section data-testid="finance-audit-events-panel" className="mt-5 rounded border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-normal text-white">System Event Trail</h2>
            <span className="text-xs font-semibold text-slate-500">{audit.length} retained events</span>
          </div>
          <div className="divide-y divide-slate-800">
            {audit.slice(0, 6).map((entry) => (
              <div key={entry.id} className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[150px_120px_minmax(0,1fr)_96px]">
                <span className="font-mono text-xs text-slate-500">{entry.timestamp}</span>
                <span className="font-semibold text-slate-300">{entry.user}</span>
                <span className="min-w-0 truncate text-slate-200">{entry.action}</span>
                <span
                  className={cx(
                    "w-fit rounded border px-2 py-0.5 text-[10px] font-black uppercase",
                    entry.severity === "critical"
                      ? "border-red-500/40 bg-red-950/40 text-red-300"
                      : entry.severity === "warning"
                        ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-300",
                  )}
                >
                  {entry.severity}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function FinanceAuditMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof AlertTriangle;
  tone: "amber" | "emerald" | "slate";
}) {
  const classes: Record<typeof tone, string> = {
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    slate: "text-slate-400",
  };
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className={cx("h-4 w-4", classes[tone])} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function FinanceKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "amber" | "emerald" | "rose";
}) {
  const classes: Record<typeof tone, { card: string; label: string; value: string }> = {
    slate: {
      card: "border-slate-700 bg-slate-900",
      label: "text-slate-500",
      value: "text-white",
    },
    amber: {
      card: "border-amber-900/50 bg-amber-950/10",
      label: "text-amber-500/80",
      value: "text-amber-500",
    },
    emerald: {
      card: "border-emerald-900/50 bg-emerald-950/20",
      label: "text-emerald-500/80",
      value: "text-emerald-400",
    },
    rose: {
      card: "border-rose-900/50 bg-rose-950/20",
      label: "text-rose-400/80",
      value: "text-rose-300",
    },
  };

  return (
    <div className={cx("rounded border p-4", classes[tone].card)}>
      <p className={cx("mb-1 text-[10px] font-black uppercase tracking-normal", classes[tone].label)}>{label}</p>
      <p className={cx("text-2xl font-black", classes[tone].value)}>{value}</p>
    </div>
  );
}

function financeAllerTitle(aller: string) {
  const suffix = aller.split("-").pop() ?? aller;
  return `Control Batch ${suffix}`;
}

function FinanceMeasureStack({ item, source }: { item: InventoryReference; source: "expected" | "lastCount" }) {
  const values = source === "expected" ? item.expected : item.lastCount;
  return (
    <div className="space-y-1">
      {item.required.map((measure) => (
        <p key={measure}>
          {formatNumber(values?.[measure])} {item.unit[measure]}
        </p>
      ))}
    </div>
  );
}

function financeProductType(item: InventoryReference) {
  if (item.required.includes("volume") && item.required.includes("quantity")) {
    return "Containerized";
  }
  if (item.required.includes("weight") && item.required.includes("quantity")) {
    return "Composite";
  }
  if (item.required.includes("volume")) {
    return "Liquid";
  }
  if (item.required.includes("weight")) {
    return "Bulk";
  }
  return "Unit Stock";
}

function financePrimaryMeasure(item: InventoryReference) {
  return item.required[0] ?? "quantity";
}

function financePrimaryValue(item: InventoryReference, source: "expected" | "lastCount") {
  const measure = financePrimaryMeasure(item);
  const values = source === "expected" ? item.expected : item.lastCount;
  return values?.[measure];
}

function financeSystemQuantity(item: InventoryReference) {
  return formatNumber(financePrimaryValue(item, "expected"));
}

function financeAuditQuantity(item: InventoryReference) {
  return formatNumber(financePrimaryValue(item, "lastCount"));
}

function financeAuditDelta(items: InventoryReference[]) {
  const total = items.reduce((sum, item) => {
    const expected = financePrimaryValue(item, "expected");
    const actual = financePrimaryValue(item, "lastCount");
    if (expected === undefined || actual === undefined) {
      return sum;
    }
    return sum + Math.abs(actual - expected);
  }, 0);
  return formatNumber(total);
}

function financeLocation(item: InventoryReference) {
  const checksum = Array.from(`${item.id}${item.aller}`).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `Aisle ${String((checksum % 14) + 1).padStart(2, "0")}, Bin ${(checksum % 9) + 1}`;
}

function financeTimestamp(index: number) {
  const totalMinutes = Math.max(0, 10 * 60 + 42 - index * 7);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = (15 + index * 7) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function financeDifference(item: InventoryReference) {
  const measure = financePrimaryMeasure(item);
  const expected = item.expected[measure];
  const actual = item.lastCount?.[measure];
  if (expected === undefined || actual === undefined) {
    return "---";
  }
  const diff = actual - expected;
  if (Math.abs(diff) <= 0.01) {
    return "0";
  }
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatNumber(diff)}`;
}

function financeDifferenceClass(item: InventoryReference) {
  const measure = financePrimaryMeasure(item);
  const expected = item.expected[measure];
  const actual = item.lastCount?.[measure];
  if (expected === undefined || actual === undefined) {
    return "text-slate-500";
  }
  return Math.abs(actual - expected) <= 0.01 ? "text-emerald-300" : "text-red-300";
}

function financeRowClass(status: CountStatus) {
  const rowClasses: Record<CountStatus, string> = {
    pending: "bg-slate-800/20",
    matching: "",
    discrepancy: "bg-amber-950/10 hover:bg-amber-950/20",
    locked: "bg-slate-800/20",
    validated: "",
  };
  return rowClasses[status];
}

function financeAccentClass(status: CountStatus) {
  const classes: Record<CountStatus, string> = {
    pending: "border-l-2 border-slate-600",
    matching: "",
    discrepancy: "border-l-2 border-amber-500",
    locked: "border-l-2 border-slate-600",
    validated: "",
  };
  return classes[status];
}

function financeIconClass(status: CountStatus) {
  const classes: Record<CountStatus, string> = {
    pending: "text-slate-400",
    matching: "text-emerald-500",
    discrepancy: "text-amber-500",
    locked: "text-slate-400",
    validated: "text-emerald-500",
  };
  return classes[status];
}

function financeStatusIcon(status: CountStatus) {
  const icons: Record<CountStatus, typeof CheckCircle2> = {
    pending: Activity,
    matching: CheckCircle2,
    discrepancy: AlertTriangle,
    locked: LockKeyhole,
    validated: ClipboardCheck,
  };
  return icons[status];
}

function financeStatusLabel(status: CountStatus) {
  const labels: Record<CountStatus, string> = {
    pending: "Pending",
    matching: "Confirmed",
    discrepancy: "Flagged",
    locked: "Pending Override",
    validated: "Confirmed",
  };
  return labels[status];
}

function FinanceStatusBadge({ status }: { status: CountStatus }) {
  const classes: Record<CountStatus, string> = {
    pending: "border-slate-600 bg-slate-800 text-slate-300",
    matching: "border-emerald-900/50 bg-emerald-950 text-emerald-400",
    discrepancy: "border-amber-900/50 bg-amber-950 text-amber-400",
    locked: "border-slate-600 bg-slate-800 text-slate-300",
    validated: "border-emerald-900/50 bg-emerald-950 text-emerald-400",
  };
  return (
    <span className={cx("inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-normal", classes[status])}>
      {financeStatusLabel(status)}
    </span>
  );
}

function MeasureStack({ item, source }: { item: InventoryReference; source: "expected" | "lastCount" }) {
  const values = source === "expected" ? item.expected : item.lastCount;
  return (
    <div className="space-y-1">
      {item.required.map((measure) => (
        <p key={measure}>
          {measureLabels[measure]}: {formatNumber(values?.[measure])} {item.unit[measure]}
        </p>
      ))}
    </div>
  );
}

function FinanceTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function AdminInterface({
  references,
  users,
  groups,
  audit,
  currentUser,
  appendAudit,
  onRefresh,
}: {
  references: InventoryReference[];
  users: OperatorUser[];
  groups: CounterGroup[];
  audit: AuditEntry[];
  currentUser: OperatorUser;
  appendAudit: (user: string, action: string, severity?: AuditEntry["severity"], ip?: string) => void;
  onRefresh: () => Promise<AppState>;
}) {
  const [newUser, setNewUser] = useState({ username: "", fullName: "", role: "counter" as Role, group: "Group A" });
  const [adminView, setAdminView] = useState<"control" | "live">("control");
  const [showUserForm, setShowUserForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [processLocked, setProcessLocked] = useState(references.some((item) => item.status === "locked"));
  const [auditQuery, setAuditQuery] = useState("");
  const [adminNotice, setAdminNotice] = useState("System state synced with in-memory runtime.");
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [adminBatchAssignments, setAdminBatchAssignments] = useState<Record<string, string>>({});
  const [profileEditorUser, setProfileEditorUser] = useState<OperatorUser | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    fullName: "",
    role: "counter" as Role,
    group: "Group A",
    locked: false,
  });
  const [newReference, setNewReference] = useState({
    id: "",
    sku: "",
    name: "",
    aller: "ALLER-01",
    assignedGroup: "Group A",
    quantity: "",
    volume: "",
    weight: "",
    required: ["quantity"] as MeasureType[],
  });
  const adminGroupNames = useMemo(() => activeGroupNames(groups), [groups]);
  const adminCounterGroups = useMemo(() => counterGroupNames(groups), [groups]);
  const lockedCount = references.filter((item) => item.status === "locked").length;
  const discrepancyCount = references.filter((item) => item.status === "discrepancy").length;
  const completedCount = references.filter((item) => item.status === "matching" || item.status === "validated").length;
  const allers = Array.from(new Set(references.map((item) => item.aller))).sort();
  const batchRows = allers.map((aller) => {
    const batchItems = references.filter((item) => item.aller === aller);
    const assignedGroups = Array.from(new Set(batchItems.map((item) => item.assignedGroup))).filter(Boolean);
    return {
      aller,
      references: batchItems.length,
      assignedGroups,
      selectedGroup: adminBatchAssignments[aller] ?? (assignedGroups.length === 1 ? assignedGroups[0] : ""),
      issues: batchItems.filter((item) => item.status === "discrepancy" || item.status === "locked").length,
    };
  });
  const sortedUsers = [...users].sort((first, second) => first.fullName.localeCompare(second.fullName));
  const lockedReferences = references.filter((item) => item.status === "locked");
  const filteredAudit = audit.filter((entry) => {
    const query = auditQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      entry.timestamp.toLowerCase().includes(query) ||
      entry.user.toLowerCase().includes(query) ||
      entry.action.toLowerCase().includes(query) ||
      entry.ip.toLowerCase().includes(query) ||
      entry.severity.toLowerCase().includes(query)
    );
  });

  const addUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUser.username.trim() || !newUser.fullName.trim()) {
      return;
    }
    apiPost("/api/admin/users", { actor: currentUser.username, user: newUser })
      .then(() => onRefresh())
      .then(() => {
        setNewUser({ username: "", fullName: "", role: "counter", group: "Group A" });
        setShowUserForm(false);
        setAdminNotice("User created with default password: align.");
      })
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to add user: ${error.message}` : "Failed to add user",
          "warning",
        ),
      );
  };

  const addReference = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newReference.id.trim() || !newReference.name.trim() || !newReference.required.length) {
      return;
    }
    const expected: CountMap = {};
    newReference.required.forEach((measure) => {
      const value = toNumber(newReference[measure]);
      expected[measure] = value ?? 0;
    });
    const item: InventoryReference = {
      id: newReference.id.trim().toUpperCase(),
      sku: newReference.sku.trim() || newReference.id.trim().toUpperCase(),
      name: newReference.name.trim(),
      aller: newReference.aller.trim().toUpperCase(),
      assignedGroup: newReference.assignedGroup,
      required: newReference.required,
      expected,
      unit: measureUnits,
      status: "pending",
      attempt: 0,
    };
    apiPost("/api/admin/references", { actor: currentUser.username, reference: item })
      .then(() => onRefresh())
      .then(() => {
        setNewReference({
          id: "",
          sku: "",
          name: "",
          aller: "ALLER-01",
          assignedGroup: "Group A",
          quantity: "",
          volume: "",
          weight: "",
          required: ["quantity"],
        });
        setShowReferenceForm(false);
        setAdminNotice(`${item.id} added to ${item.aller}.`);
      })
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to add reference: ${error.message}` : "Failed to add reference",
          "warning",
        ),
      );
  };

  const dayReset = () => {
    setShowResetConfirm(false);
    apiPost("/api/admin/day-reset", { actor: currentUser.username })
      .then(() => onRefresh())
      .then(() => {
        setProcessLocked(false);
        setAdminNotice("Day reset completed. Counter sessions and temporary locks were cleared.");
      })
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed day reset: ${error.message}` : "Failed day reset",
          "critical",
        ),
      );
  };

  const updateUser = (username: string, updates: { fullName?: string; role?: Role; group?: string; locked?: boolean }) => {
    apiPatch("/api/admin/users", {
      actor: currentUser.username,
      username,
      updates,
    })
      .then(() => onRefresh())
      .then(() => setAdminNotice(`User ${username} updated.`))
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to update ${username}: ${error.message}` : `Failed to update ${username}`,
          "warning",
        ),
      );
  };

  const addGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newGroup.name.trim()) {
      return;
    }
    apiPost("/api/admin/groups", {
      actor: currentUser.username,
      group: {
        name: newGroup.name.trim(),
        description: newGroup.description.trim(),
        active: true,
      },
    })
      .then(() => onRefresh())
      .then(() => {
        setNewGroup({ name: "", description: "" });
        setShowGroupForm(false);
        setAdminNotice("Operational group created and available for assignment.");
      })
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to add group: ${error.message}` : "Failed to add group",
          "warning",
        ),
      );
  };

  const updateGroup = (name: string, updates: { description?: string; active?: boolean }) => {
    apiPatch("/api/admin/groups", {
      actor: currentUser.username,
      name,
      updates,
    })
      .then(() => onRefresh())
      .then(() => setAdminNotice(`Group ${name} updated.`))
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to update group ${name}: ${error.message}` : `Failed to update group ${name}`,
          "warning",
        ),
      );
  };

  const assignAdminBatch = (aller: string, group: string) => {
    if (!group) {
      return;
    }
    apiPost<{ ok: boolean; updated: number }>("/api/finance/assign-batch", {
      actor: currentUser.username,
      aller,
      group,
    })
      .then((result) => onRefresh().then(() => result))
      .then((result) => setAdminNotice(`${aller} assigned to ${group}. ${result.updated} references updated.`))
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to assign ${aller}: ${error.message}` : `Failed to assign ${aller}`,
          "warning",
        ),
      );
  };

  const openProfileEditor = (user: OperatorUser) => {
    setProfileEditorUser(user);
    setProfileDraft({
      fullName: user.fullName,
      role: user.role,
      group: user.group,
      locked: user.locked,
    });
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileEditorUser || !profileDraft.fullName.trim()) {
      return;
    }
    const username = profileEditorUser.username;
    updateUser(username, {
      fullName: profileDraft.fullName.trim(),
      role: profileDraft.role,
      group: profileDraft.group,
      locked: profileDraft.locked,
    });
    setProfileEditorUser(null);
  };

  const unlockReference = (item: InventoryReference) => {
    apiPatch("/api/admin/references", {
      actor: currentUser.username,
      referenceId: item.id,
      updates: { status: "pending", attempt: 0 },
    })
      .then(() => onRefresh())
      .then(() => setAdminNotice(`${item.id} unlocked and returned to pending count.`))
      .catch((error) =>
        appendAudit(
          currentUser.username,
          error instanceof Error ? `Failed to unlock ${item.id}: ${error.message}` : `Failed to unlock ${item.id}`,
          "warning",
        ),
      );
  };

  const toggleProcessLock = () => {
    setProcessLocked((previous) => {
      const next = !previous;
      appendAudit(currentUser.username, `Process lock ${next ? "enabled" : "released"} from admin control center`, next ? "warning" : "info");
      setAdminNotice(next ? "Process lock enabled for active counter operations." : "Process lock released.");
      return next;
    });
  };

  const toggleMeasure = (measure: MeasureType) => {
    setNewReference((previous) => {
      const exists = previous.required.includes(measure);
      const nextRequired = exists
        ? previous.required.filter((selected) => selected !== measure)
        : [...previous.required, measure];
      return { ...previous, required: nextRequired };
    });
  };

  const importSapFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const importedReferences = rows
        .map((row) => {
          const id = String(cellValue(row, ["reference", "ref", "id", "material", "materialcode"]) ?? "").trim();
          if (!id) {
            return null;
          }
          const sku = String(cellValue(row, ["sku", "barcode", "ean"]) ?? id).trim();
          const name = String(cellValue(row, ["name", "description", "materialdescription"]) ?? "SAP Material").trim();
          const aller = String(cellValue(row, ["aller", "batch", "controlgroup"]) ?? "ALLER-IMPORT").trim();
          const assignedGroup = String(cellValue(row, ["group", "countergroup", "assignedgroup"]) ?? "Group A").trim();
          const expected: CountMap = {};
          (["quantity", "volume", "weight"] as MeasureType[]).forEach((measure) => {
            const value = toNumber(cellValue(row, [measure, `expected${measure}`, `sap${measure}`]));
            if (value !== undefined) {
              expected[measure] = value;
            }
          });
          const required = (Object.keys(expected) as MeasureType[]).length
            ? (Object.keys(expected) as MeasureType[])
            : (["quantity"] as MeasureType[]);
          if (!Object.keys(expected).length) {
            expected.quantity = 0;
          }
          return {
            id,
            sku,
            name,
            aller,
            assignedGroup: adminCounterGroups.includes(assignedGroup) ? assignedGroup : "Group A",
            required,
            expected,
            unit: measureUnits,
            status: "pending" as CountStatus,
            attempt: 0,
          };
        })
        .filter((item): item is InventoryReference => Boolean(item));

      const result = await apiPost<{ ok: boolean; imported: number }>("/api/references/import", {
        actor: currentUser.username,
        fileName: file.name,
        references: importedReferences,
      });
      await onRefresh();
      setAdminNotice(`${result.imported} SAP rows imported from ${file.name}.`);
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : "File import failed. Check SAP column names.");
      appendAudit(currentUser.username, `Failed admin SAP import for ${file.name}`, "warning");
    }
  };

  const handleAdminFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importSapFile(file);
    }
    event.target.value = "";
  };

  const downloadCsv = (fileName: string, rows: Array<Record<string, string | number>>) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAuditCsv = () => {
    downloadCsv(
      `CYNCRO_AUDIT_${new Date().toISOString().slice(0, 10)}.csv`,
      filteredAudit.map((entry) => ({
        Timestamp: entry.timestamp,
        User: entry.user,
        Action: entry.action,
        IP: entry.ip,
        Severity: entry.severity,
      })),
    );
    appendAudit(currentUser.username, `Exported ${filteredAudit.length} admin audit rows`);
  };

  const exportReferencesCsv = () => {
    downloadCsv(
      `CYNCRO_REFERENCES_${new Date().toISOString().slice(0, 10)}.csv`,
      references.map((item) => ({
        Reference: item.id,
        SKU: item.sku,
        Description: item.name,
        Aller: item.aller,
        Group: item.assignedGroup,
        Status: statusStyles[item.status].label,
        Attempts: item.attempt,
        Quantity: item.expected.quantity ?? "",
        Volume: item.expected.volume ?? "",
        Weight: item.expected.weight ?? "",
      })),
    );
    appendAudit(currentUser.username, `Exported ${references.length} admin reference rows`);
  };

  const adminInputClass =
    "h-10 w-full rounded-sm border border-[#444749] bg-[#051424] px-3 text-sm text-[#d4e4fa] placeholder:text-[#8e9193] outline-none transition focus:border-white";
  const adminSmallButtonClass =
    "inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-[#8e9193] px-3 text-[11px] font-black uppercase tracking-normal text-[#d4e4fa] transition hover:border-white hover:bg-white hover:text-[#051424]";
  const adminPanelClass = "border border-[#444749] bg-[#122131]";
  const auditStatusClass: Record<AuditEntry["severity"], string> = {
    info: "border-emerald-500/30 bg-emerald-950 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-950 text-amber-300",
    critical: "border-red-500/40 bg-red-950 text-red-200",
  };

  if (adminView === "live") {
    return (
      <AdminLiveMonitorView
        references={references}
        users={users}
        audit={audit}
        currentUser={currentUser}
        onBack={() => {
          setAdminView("control");
          setAdminNotice("Returned to Admin Control Center.");
          appendAudit(currentUser.username, "Returned from admin live monitor");
        }}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-129px)] overflow-y-auto bg-[#051424] p-3 text-[#d4e4fa] sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-normal text-white">Cyncro</h1>
            <div className="hidden h-6 w-px bg-[#444749] sm:block" />
            <p className="text-sm font-medium text-[#c4c7c9]">Admin Control Center</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="admin-live-monitor-button"
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-emerald-400/30 bg-emerald-950 px-4 text-[11px] font-black uppercase tracking-normal text-emerald-300 transition hover:bg-emerald-900"
              onClick={() => {
                setAdminView("live");
                appendAudit(currentUser.username, "Opened admin live monitor");
              }}
            >
              <Activity className="h-4 w-4" />
              Live Monitor
            </button>
            <button
              type="button"
              data-testid="admin-notifications-button"
              className="flex h-10 w-10 items-center justify-center rounded-sm text-[#d4e4fa] transition hover:bg-[#1c2b3c]"
              onClick={() => appendAudit(currentUser.username, "Checked admin notifications")}
              aria-label="Admin notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="admin-settings-button"
              className="flex h-10 w-10 items-center justify-center rounded-sm text-[#d4e4fa] transition hover:bg-[#1c2b3c]"
              onClick={() => appendAudit(currentUser.username, "Opened admin settings")}
              aria-label="Admin settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#8e9193] bg-[#3f465c] text-xs font-black text-white">
              {currentUser.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricTile label="Users" value={users.length.toString()} icon={Users} />
          <AdminMetricTile label="References" value={references.length.toString()} icon={Boxes} />
          <AdminMetricTile label="Allers" value={allers.length.toString()} icon={Warehouse} />
          <AdminMetricTile label="Audit Events" value={audit.length.toString()} icon={ClipboardCheck} />
        </div>

        <div className="mb-3 rounded-sm border border-[#444749] bg-[#0d1c2d] px-4 py-3 text-sm font-semibold text-[#c4c7c9]">
          {adminNotice}
        </div>

        <div className="grid grid-cols-12 gap-3 lg:gap-4">
          <section className={cx(adminPanelClass, "col-span-12 p-5 lg:col-span-4", processLocked && "border-red-300/70")}>
            <div className="mb-4 flex items-center gap-2 text-red-200">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-black">System Controls</h2>
            </div>
            <div className="mb-5 border border-[#444749] bg-[#051424] p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-normal text-white">Process Lock</p>
                  <p className="mt-1 text-xs text-[#c4c7c9]">Freeze active counter operations</p>
                </div>
                <button
                  type="button"
                  data-testid="admin-process-lock-toggle"
                  className={cx(
                    "relative h-6 w-12 rounded-full border transition",
                    processLocked ? "border-red-300 bg-red-950" : "border-[#8e9193] bg-[#273647]",
                  )}
                  onClick={toggleProcessLock}
                  aria-label="Toggle process lock"
                >
                  <span
                    className={cx(
                      "absolute top-0.5 h-5 w-5 rounded-full transition",
                      processLocked ? "right-0.5 bg-red-200" : "left-0.5 bg-[#d4e4fa]",
                    )}
                  />
                </button>
              </div>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-2">
              <AdminCompactStat label="Locked" value={lockedCount.toString()} tone="red" />
              <AdminCompactStat label="Issues" value={discrepancyCount.toString()} tone="amber" />
              <AdminCompactStat label="Done" value={completedCount.toString()} tone="emerald" />
            </div>
            <button
              type="button"
              data-testid="admin-day-reset-button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-red-200 px-4 text-sm font-black uppercase tracking-normal text-[#051424] transition hover:bg-red-100 active:scale-[0.99]"
              onClick={() => setShowResetConfirm(true)}
            >
              Execute Day Reset
              <RefreshCcw className="h-4 w-4" />
            </button>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 p-5 lg:col-span-8")}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Security Overrides</h2>
              <span className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">
                {lockedReferences.length} entries locked
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#444749] text-[11px] uppercase tracking-normal text-[#c4c7c9]">
                    <th className="py-2 pr-4">Reference ID</th>
                    <th className="py-2 pr-4">Locked By</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {lockedReferences.length ? (
                    lockedReferences.slice(0, 5).map((item) => (
                      <tr key={item.id} className="border-b border-[#444749]/40 transition hover:bg-[#273647]">
                        <td className="py-3 pr-4 font-mono font-bold text-white">{item.id}</td>
                        <td className="py-3 pr-4">{item.secondGroup ?? item.assignedGroup}</td>
                        <td className="py-3 pr-4 text-red-200">
                          {item.attempt >= 3 ? "3 failed match attempts" : "Supervisor override required"}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            data-testid={`admin-unlock-reference-${item.id}`}
                            className={adminSmallButtonClass}
                            onClick={() => unlockReference(item)}
                          >
                            Unlock
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-6 text-sm font-semibold text-emerald-300" colSpan={4}>
                        No locked references requiring override.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#444749] bg-[#1c2b3c] p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-white" />
                <h2 className="text-lg font-black text-white">User Management</h2>
              </div>
              <button
                type="button"
                data-testid="admin-toggle-add-user-button"
                className="inline-flex h-9 items-center gap-2 rounded-sm bg-white px-4 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-[#d4e4fa]"
                onClick={() => setShowUserForm((previous) => !previous)}
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </button>
            </div>
            {showUserForm && (
              <form onSubmit={addUser} className="border-b border-[#444749] bg-[#0d1c2d] p-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <input
                    data-testid="admin-new-user-username"
                    className={adminInputClass}
                    value={newUser.username}
                    onChange={(event) => setNewUser((previous) => ({ ...previous, username: event.target.value }))}
                    placeholder="Username"
                  />
                  <input
                    data-testid="admin-new-user-fullname"
                    className={cx(adminInputClass, "md:col-span-2")}
                    value={newUser.fullName}
                    onChange={(event) => setNewUser((previous) => ({ ...previous, fullName: event.target.value }))}
                    placeholder="Full name"
                  />
                  <select
                    data-testid="admin-new-user-role"
                    className={adminInputClass}
                    value={newUser.role}
                    onChange={(event) => setNewUser((previous) => ({ ...previous, role: event.target.value as Role }))}
                  >
                    {(["counter", "financier", "admin"] as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                  <select
                    data-testid="admin-new-user-group"
                    className={adminInputClass}
                    value={newUser.group}
                    onChange={(event) => setNewUser((previous) => ({ ...previous, group: event.target.value }))}
                  >
                    {adminGroupNames.map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    data-testid="admin-cancel-add-user-button"
                    className={adminSmallButtonClass}
                    onClick={() => setShowUserForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="admin-add-user-button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-sm bg-emerald-400 px-4 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-emerald-300"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create User
                  </button>
                </div>
              </form>
            )}

            <div className="grid gap-3 bg-[#0d1c2d] p-4 xl:grid-cols-3">
              {sortedUsers.map((user) => {
                const initials = user.fullName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <article key={user.username} className="border border-[#444749] bg-[#122131] p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[#8e9193] bg-[#3f465c] text-xs font-black text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-black text-white">{user.fullName}</h3>
                          <p className="font-mono text-xs font-bold text-[#c4c7c9]">{user.username}</p>
                        </div>
                      </div>
                      <span
                        className={cx(
                          "shrink-0 rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-normal",
                          user.locked
                            ? "border-red-300/50 bg-red-950 text-red-200"
                            : "border-emerald-300/40 bg-emerald-950 text-emerald-300",
                        )}
                      >
                        {user.locked ? "Locked" : "Active"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="border border-[#444749] bg-[#051424] p-2">
                        <p className="text-[10px] font-black uppercase tracking-normal text-[#8e9193]">Role</p>
                        <p className="mt-1 font-black text-white">{roleLabels[user.role]}</p>
                      </div>
                      <div className="border border-[#444749] bg-[#051424] p-2">
                        <p className="text-[10px] font-black uppercase tracking-normal text-[#8e9193]">Group</p>
                        <p className="mt-1 font-black text-white">{user.group}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        data-testid={`admin-user-lock-${user.username}`}
                        className={cx(adminSmallButtonClass, user.locked && "border-emerald-400 text-emerald-300")}
                        onClick={() => updateUser(user.username, { locked: !user.locked })}
                      >
                        {user.locked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        type="button"
                        data-testid={`admin-edit-profile-${user.username}`}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-sm bg-white px-3 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-[#d4e4fa]"
                        onClick={() => openProfileEditor(user)}
                      >
                        <UserCog className="h-4 w-4" />
                        Edit Profile
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 overflow-hidden xl:col-span-6")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#444749] bg-[#1c2b3c] p-4">
              <div className="flex items-center gap-3">
                <Warehouse className="h-5 w-5 text-white" />
                <h2 className="text-lg font-black text-white">Group Management</h2>
              </div>
              <button
                type="button"
                data-testid="admin-toggle-add-group-button"
                className={adminSmallButtonClass}
                onClick={() => setShowGroupForm((previous) => !previous)}
              >
                Add Group
              </button>
            </div>
            {showGroupForm && (
              <form onSubmit={addGroup} className="border-b border-[#444749] bg-[#0d1c2d] p-4">
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <input
                    data-testid="admin-new-group-name"
                    className={adminInputClass}
                    value={newGroup.name}
                    onChange={(event) => setNewGroup((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Group D"
                  />
                  <input
                    data-testid="admin-new-group-description"
                    className={adminInputClass}
                    value={newGroup.description}
                    onChange={(event) => setNewGroup((previous) => ({ ...previous, description: event.target.value }))}
                    placeholder="Warehouse zone or responsibility"
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    data-testid="admin-cancel-add-group-button"
                    className={adminSmallButtonClass}
                    onClick={() => setShowGroupForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="admin-add-group-button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-sm bg-emerald-400 px-4 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-emerald-300"
                  >
                    Create Group
                  </button>
                </div>
              </form>
            )}
            <div className="divide-y divide-[#444749]/50">
              {groups.map((group) => {
                const userCount = users.filter((user) => user.group === group.name).length;
                const referenceCount = references.filter((reference) => reference.assignedGroup === group.name).length;
                return (
                  <div key={group.name} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-white">{group.name}</h3>
                        <span
                          className={cx(
                            "rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-normal",
                            group.active
                              ? "border-emerald-300/40 bg-emerald-950 text-emerald-300"
                              : "border-[#8e9193] bg-[#273647] text-[#c4c7c9]",
                          )}
                        >
                          {group.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <input
                        data-testid={`admin-group-description-${group.name}`}
                        className={cx(adminInputClass, "mt-2 h-9 text-xs")}
                        defaultValue={group.description}
                        onBlur={(event) => {
                          if (event.target.value !== group.description) {
                            updateGroup(group.name, { description: event.target.value });
                          }
                        }}
                      />
                    </div>
                    <AdminCompactStat label="Users" value={userCount.toString()} tone="emerald" />
                    <AdminCompactStat label="Refs" value={referenceCount.toString()} tone="amber" />
                    <button
                      type="button"
                      data-testid={`admin-group-active-${group.name}`}
                      className={cx(adminSmallButtonClass, group.active && "border-emerald-400 text-emerald-300")}
                      onClick={() => updateGroup(group.name, { active: !group.active })}
                    >
                      {group.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 overflow-hidden xl:col-span-6")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#444749] bg-[#1c2b3c] p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-white" />
                <h2 className="text-lg font-black text-white">Batch Assignments</h2>
              </div>
              <span className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">{batchRows.length} allers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#0d1c2d] text-[11px] uppercase tracking-normal text-[#c4c7c9]">
                  <tr>
                    <th className="px-4 py-2">Aller</th>
                    <th className="px-4 py-2 text-right">Refs</th>
                    <th className="px-4 py-2">Current</th>
                    <th className="px-4 py-2">Assign To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444749]/40">
                  {batchRows.map((row) => (
                    <tr key={row.aller} className="transition hover:bg-[#273647]">
                      <td className="px-4 py-3 font-mono font-black text-white">{row.aller}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.references}</td>
                      <td className="px-4 py-3 text-xs text-[#c4c7c9]">
                        {row.assignedGroups.join(", ") || "Unassigned"}
                        {row.issues > 0 ? <span className="ml-2 text-amber-300">{row.issues} issues</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <select
                            data-testid={`admin-batch-group-${row.aller}`}
                            className={cx(adminInputClass, "h-9 text-xs")}
                            value={row.selectedGroup}
                            onChange={(event) =>
                              setAdminBatchAssignments((previous) => ({ ...previous, [row.aller]: event.target.value }))
                            }
                          >
                            <option value="">Select group</option>
                            {adminCounterGroups.map((group) => (
                              <option key={group}>{group}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            data-testid={`admin-assign-batch-${row.aller}`}
                            className={adminSmallButtonClass}
                            onClick={() => assignAdminBatch(row.aller, row.selectedGroup)}
                          >
                            Apply
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 p-4 xl:col-span-6")}>
            <div className="mb-4 flex items-center gap-2">
              <Boxes className="h-5 w-5 text-white" />
              <h2 className="text-lg font-black text-white">Inventory Oversight</h2>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-3 border border-[#444749] bg-[#051424] p-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-black text-white">Batches (See Allers)</h3>
                  <p className="text-sm text-[#c4c7c9]">{allers.length} allers, {references.length} references, {completedCount} completed.</p>
                </div>
                <button
                  type="button"
                  data-testid="admin-view-batches-button"
                  className={adminSmallButtonClass}
                  onClick={() => setAdminNotice(`${allers.join(", ") || "No allers"} available for assignment review.`)}
                >
                  View / Edit
                </button>
              </div>
              <div className="flex flex-col justify-between gap-3 border border-[#444749] bg-[#051424] p-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-black text-white">References</h3>
                  <p className="text-sm text-[#c4c7c9]">Manage product references and criteria.</p>
                </div>
                <button
                  type="button"
                  data-testid="admin-toggle-add-reference-button"
                  className={adminSmallButtonClass}
                  onClick={() => setShowReferenceForm((previous) => !previous)}
                >
                  View / Edit
                </button>
              </div>
            </div>

            {showReferenceForm && (
              <form onSubmit={addReference} className="mt-4 border border-[#444749] bg-[#0d1c2d] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-[#c4c7c9]" />
                  <h3 className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">Add Reference</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    data-testid="admin-new-reference-id"
                    className={adminInputClass}
                    value={newReference.id}
                    onChange={(event) => setNewReference((previous) => ({ ...previous, id: event.target.value }))}
                    placeholder="Reference"
                  />
                  <input
                    data-testid="admin-new-reference-sku"
                    className={adminInputClass}
                    value={newReference.sku}
                    onChange={(event) => setNewReference((previous) => ({ ...previous, sku: event.target.value }))}
                    placeholder="SKU"
                  />
                  <input
                    data-testid="admin-new-reference-name"
                    className={cx(adminInputClass, "md:col-span-2")}
                    value={newReference.name}
                    onChange={(event) => setNewReference((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Material name"
                  />
                  <input
                    data-testid="admin-new-reference-aller"
                    className={adminInputClass}
                    value={newReference.aller}
                    onChange={(event) => setNewReference((previous) => ({ ...previous, aller: event.target.value }))}
                    placeholder="ALLER-01"
                  />
                  <select
                    data-testid="admin-new-reference-group"
                    className={adminInputClass}
                    value={newReference.assignedGroup}
                    onChange={(event) =>
                      setNewReference((previous) => ({ ...previous, assignedGroup: event.target.value }))
                    }
                  >
                    {adminCounterGroups.map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {(["quantity", "volume", "weight"] as MeasureType[]).map((measure) => (
                    <label key={measure} className="border border-[#444749] bg-[#051424] p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">
                          {measureLabels[measure]}
                        </span>
                        <input
                          data-testid={`admin-new-reference-required-${measure}`}
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-400"
                          checked={newReference.required.includes(measure)}
                          onChange={() => toggleMeasure(measure)}
                        />
                      </div>
                      <input
                        data-testid={`admin-new-reference-${measure}`}
                        className={adminInputClass}
                        type="number"
                        min="0"
                        step={measure === "quantity" ? "1" : "0.01"}
                        value={newReference[measure]}
                        onChange={(event) =>
                          setNewReference((previous) => ({ ...previous, [measure]: event.target.value }))
                        }
                        placeholder={measureUnits[measure]}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    data-testid="admin-cancel-add-reference-button"
                    className={adminSmallButtonClass}
                    onClick={() => setShowReferenceForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="admin-add-reference-button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-sm bg-emerald-400 px-4 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-emerald-300"
                  >
                    <Boxes className="h-4 w-4" />
                    Add Reference
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className={cx(adminPanelClass, "col-span-12 p-4 xl:col-span-6")}>
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-white" />
              <h2 className="text-lg font-black text-white">File Operations</h2>
            </div>
            <p className="mb-5 text-sm text-[#c4c7c9]">
              Import master data from SAP or export the local reconciliation dataset.
            </p>
            <input
              data-testid="admin-import-file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleAdminFileChange}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="admin-import-sap-button"
                className="flex min-h-24 flex-col items-center justify-center gap-2 border border-[#444749] bg-[#051424] p-4 text-[11px] font-black uppercase tracking-normal text-[#d4e4fa] transition hover:bg-[#273647]"
                onClick={() => document.querySelector<HTMLInputElement>('[data-testid="admin-import-file-input"]')?.click()}
              >
                <CloudUpload className="h-7 w-7 text-emerald-300" />
                Import SAP Data
              </button>
              <button
                type="button"
                data-testid="admin-export-results-button"
                className="flex min-h-24 flex-col items-center justify-center gap-2 border border-[#444749] bg-[#051424] p-4 text-[11px] font-black uppercase tracking-normal text-[#d4e4fa] transition hover:bg-[#273647]"
                onClick={exportReferencesCsv}
              >
                <Download className="h-7 w-7 text-white" />
                Export Results
              </button>
            </div>
          </section>

          <section className={cx(adminPanelClass, "col-span-12 overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#444749] p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-white">Audit Log</h2>
                <span className="rounded-sm bg-[#3f465c] px-2 py-1 text-[10px] font-black uppercase tracking-normal text-[#bec6e0]">
                  Real-Time
                </span>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e9193]" />
                  <input
                    data-testid="admin-audit-search-input"
                    className={cx(adminInputClass, "pl-9 sm:w-72")}
                    value={auditQuery}
                    onChange={(event) => setAuditQuery(event.target.value)}
                    placeholder="Search logs..."
                  />
                </div>
                <button
                  type="button"
                  data-testid="admin-audit-export-button"
                  className={adminSmallButtonClass}
                  onClick={exportAuditCsv}
                >
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-sm">
                <thead className="bg-[#0d1c2d] text-[11px] uppercase tracking-normal text-[#c4c7c9]">
                  <tr>
                    <th className="w-1/6 border-r border-[#444749]/40 px-4 py-2">Timestamp</th>
                    <th className="w-1/6 border-r border-[#444749]/40 px-4 py-2">User</th>
                    <th className="w-1/3 border-r border-[#444749]/40 px-4 py-2">Action</th>
                    <th className="w-1/6 border-r border-[#444749]/40 px-4 py-2">IP Address</th>
                    <th className="w-1/6 px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444749]/40 font-mono text-xs">
                  {filteredAudit.slice(0, 12).map((entry) => (
                    <tr key={entry.id} className="transition hover:bg-[#273647]">
                      <td className="border-r border-[#444749]/30 px-4 py-3 text-[#c4c7c9]">{entry.timestamp}</td>
                      <td className="border-r border-[#444749]/30 px-4 py-3 font-bold text-white">{entry.user}</td>
                      <td className="border-r border-[#444749]/30 px-4 py-3 text-[#d4e4fa]">{entry.action}</td>
                      <td className="border-r border-[#444749]/30 px-4 py-3">{entry.ip}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            "inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-normal",
                            auditStatusClass[entry.severity],
                          )}
                        >
                          {entry.severity === "info" ? "success" : entry.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#444749] bg-[#0d1c2d] px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">
                Showing {Math.min(filteredAudit.length, 12)} of {filteredAudit.length} logs
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    type="button"
                    data-testid={`admin-audit-page-${page}`}
                    className={cx(
                      "h-8 w-8 rounded-sm border text-xs font-black transition",
                      page === 1
                        ? "border-white bg-white text-[#051424]"
                        : "border-[#444749] text-[#d4e4fa] hover:bg-[#273647]",
                    )}
                    onClick={() => setAdminNotice(`Audit page ${page} selected.`)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {profileEditorUser && (
          <div
            data-testid="admin-profile-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#051424]/85 p-4 backdrop-blur-sm"
          >
            <form onSubmit={saveProfile} className="w-full max-w-xl border border-[#8e9193] bg-[#122131] p-5 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-normal text-emerald-300">Operator Profile</p>
                  <h2 className="mt-1 text-2xl font-black text-white">{profileEditorUser.username}</h2>
                  <p className="mt-1 text-sm font-medium text-[#c4c7c9]">Edit identity, access, assignment, and account state.</p>
                </div>
                <button
                  type="button"
                  data-testid="admin-profile-cancel"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#444749] text-[#d4e4fa] transition hover:bg-[#273647]"
                  onClick={() => setProfileEditorUser(null)}
                  aria-label="Close profile editor"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">Full Name</span>
                  <input
                    data-testid="admin-profile-fullname"
                    className={adminInputClass}
                    value={profileDraft.fullName}
                    onChange={(event) => setProfileDraft((previous) => ({ ...previous, fullName: event.target.value }))}
                    placeholder="Full name"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">Role</span>
                  <select
                    data-testid="admin-profile-role"
                    className={adminInputClass}
                    value={profileDraft.role}
                    onChange={(event) => setProfileDraft((previous) => ({ ...previous, role: event.target.value as Role }))}
                  >
                    {(["counter", "financier", "admin"] as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">Group</span>
                  <select
                    data-testid="admin-profile-group"
                    className={adminInputClass}
                    value={profileDraft.group}
                    onChange={(event) => setProfileDraft((previous) => ({ ...previous, group: event.target.value }))}
                  >
                    {adminGroupNames.map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center justify-between gap-4 border border-[#444749] bg-[#051424] p-3">
                <span>
                  <span className="block text-[11px] font-black uppercase tracking-normal text-white">Account Locked</span>
                  <span className="mt-1 block text-xs text-[#c4c7c9]">Locked users cannot access their assigned interface.</span>
                </span>
                <input
                  data-testid="admin-profile-lock"
                  type="checkbox"
                  className="h-5 w-5 accent-emerald-400"
                  checked={profileDraft.locked}
                  onChange={(event) => setProfileDraft((previous) => ({ ...previous, locked: event.target.checked }))}
                />
              </label>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  data-testid="admin-profile-cancel-bottom"
                  className={adminSmallButtonClass}
                  onClick={() => setProfileEditorUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="admin-profile-save"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-emerald-400 px-5 text-[11px] font-black uppercase tracking-normal text-[#051424] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!profileDraft.fullName.trim()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#051424]/85 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md border border-red-300/70 bg-[#1c2b3c] p-6 shadow-2xl">
              <AlertTriangle className="mb-4 h-10 w-10 text-red-200" />
              <h2 className="text-xl font-black text-white">Confirm System Reset</h2>
              <p className="mt-3 text-sm leading-6 text-[#c4c7c9]">
                This archives the active cycle state, clears temporary locks, and returns references to pending count.
              </p>
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  data-testid="admin-confirm-day-reset-button"
                  className="h-11 rounded-sm bg-red-200 text-sm font-black uppercase tracking-normal text-[#051424] transition hover:bg-red-100"
                  onClick={dayReset}
                >
                  I Understand, Execute Now
                </button>
                <button
                  type="button"
                  data-testid="admin-cancel-day-reset-button"
                  className={adminSmallButtonClass}
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLiveMonitorView({
  references,
  users,
  audit,
  currentUser,
  onBack,
}: {
  references: InventoryReference[];
  users: OperatorUser[];
  audit: AuditEntry[];
  currentUser: OperatorUser;
  onBack: () => void;
}) {
  const counterUsers = users.filter((user) => user.role === "counter");
  const activeCounters = counterUsers.filter((user) => !user.locked).length;
  const discrepancyItems = references.filter((item) => item.status === "discrepancy" || item.status === "locked");
  const submittedItems = references.filter((item) => item.status === "matching" || item.status === "validated");
  const openDiscrepancies = discrepancyItems.length;
  const systemLoad = Math.min(92, Math.max(24, 28 + openDiscrepancies * 7 + Math.round((activeCounters / Math.max(counterUsers.length, 1)) * 18)));
  const throughputBars = [20, 35, 25, 45, 60, 40, 70, 85, 65, 90, 75, 50, 80, 95, 60, 40];
  const feedEntries = [
    ...submittedItems.slice(0, 3).map((item, index) => ({
      id: `submitted-${item.id}`,
      tone: "emerald" as const,
      title: item.id,
      action: "Count Submitted",
      meta: item.assignedGroup,
      detail: "",
      time: financeTimestamp(index),
    })),
    ...discrepancyItems.slice(0, 3).map((item, index) => ({
      id: `issue-${item.id}`,
      tone: item.status === "locked" ? ("red" as const) : ("amber" as const),
      title: item.id,
      action: item.status === "locked" ? "Reference Locked" : "Match Failed",
      meta: item.secondGroup ?? item.assignedGroup,
      detail: item.status === "locked" ? "3 failed attempts" : `Variance: ${financeDifference(item)}`,
      time: financeTimestamp(index + 3),
    })),
    ...audit.slice(0, 4).map((entry, index) => ({
      id: `audit-${entry.id}`,
      tone: entry.severity === "critical" ? ("red" as const) : entry.severity === "warning" ? ("amber" as const) : ("emerald" as const),
      title: entry.user,
      action: entry.action,
      meta: entry.ip,
      detail: "",
      time: entry.timestamp.split(" ").at(-1) ?? financeTimestamp(index + 6),
    })),
  ].slice(0, 8);
  const criticalAlerts = discrepancyItems.length
    ? discrepancyItems.slice(0, 3).map((item, index) => ({
        id: item.id,
        tone: item.status === "locked" ? ("red" as const) : ("amber" as const),
        title: item.status === "locked" ? `${item.id} Locked - ${financeLocation(item)}` : `${item.id} Variance Detected`,
        code: item.status === "locked" ? "SYS_ERR_04" : "COUNT_WARN",
        description:
          item.status === "locked"
            ? `Manual resolution required after ${item.attempt} attempts by ${item.assignedGroup}.`
            : `${item.name} has a reconciliation difference of ${financeDifference(item)}.`,
        time: financeTimestamp(index),
      }))
    : [
        {
          id: "healthy-cycle",
          tone: "emerald" as const,
          title: "No Critical Alerts",
          code: "SYS_OK",
          description: "All current references are available for normal monitoring.",
          time: financeTimestamp(0),
        },
      ];

  return (
    <div data-testid="admin-live-monitor-view" className="min-h-[calc(100vh-129px)] bg-[#020617] text-slate-300">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#020617]">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-5">
            <span className="text-xl font-black text-white">Cyncro Live</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="admin-live-monitor-back-button"
              className="inline-flex h-9 items-center justify-center rounded-sm border border-slate-700 px-3 text-[11px] font-black uppercase tracking-normal text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
              onClick={onBack}
            >
              Back to Admin
            </button>
            <button
              type="button"
              data-testid="admin-live-monitor-alerts-button"
              className="flex h-9 w-9 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-900 hover:text-emerald-300"
              aria-label="Live monitor alerts"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="admin-live-monitor-settings-button"
              className="flex h-9 w-9 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-900 hover:text-emerald-300"
              aria-label="Live monitor settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-sm border border-slate-700 bg-slate-900 text-xs font-black text-white">
              {currentUser.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-4xl font-black leading-none text-white sm:text-5xl">System Monitor</h1>
            <p className="mt-2 text-base font-medium text-slate-400 sm:text-lg">
              Real-time throughput and infrastructure health.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LiveMonitorChip label="ENV: PROD" />
            <LiveMonitorChip label="NODE: ALPHA_01" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="order-2 min-w-0 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <LiveMonitorMetric
                label="Active Counters"
                value={activeCounters.toString()}
                suffix={`/ ${counterUsers.length || users.length}`}
                icon={Users}
                tone="slate"
              />
              <LiveMonitorMetric
                label="Discrepancies"
                value={openDiscrepancies.toString()}
                suffix="Open"
                icon={AlertTriangle}
                tone="red"
              />
              <LiveMonitorMetric
                label="System Load"
                value={`${systemLoad}%`}
                suffix="CPU"
                icon={Settings}
                tone="slate"
                progress={systemLoad}
              />
            </div>

            <section data-testid="admin-live-throughput-chart" className="border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-white sm:text-2xl">System Throughput</h2>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-normal text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-500">Requests / Hour</span>
              </div>
              <div className="relative h-[320px] overflow-hidden">
                <div className="absolute inset-x-0 top-6 flex h-[240px] flex-col justify-between opacity-25">
                  {[0, 1, 2, 3].map((line) => (
                    <span key={line} className="border-b border-slate-600" />
                  ))}
                </div>
                <div className="relative z-10 flex h-[264px] items-end justify-between gap-2 px-2 pt-8">
                  {throughputBars.map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="min-w-[8px] flex-1 rounded-t-sm bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.18)]"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex justify-between px-1 text-[10px] font-black uppercase tracking-normal text-slate-500">
                  <span>14:00</span>
                  <span>14:15</span>
                  <span>14:30</span>
                  <span>14:45</span>
                  <span>15:00 Now</span>
                </div>
              </div>
            </section>

            <section data-testid="admin-live-critical-alerts">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Critical Alerts
              </h3>
              <div className="grid gap-3">
                {criticalAlerts.map((alert) => (
                  <LiveMonitorAlert key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          </section>

          <aside data-testid="admin-live-realtime-feed" className="order-1 flex max-h-[850px] min-h-[520px] flex-col border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-lg font-black text-white">Real-Time Feed</h3>
              <button
                type="button"
                data-testid="admin-live-feed-filter-button"
                className="text-slate-400 transition hover:text-emerald-300"
                aria-label="Filter real-time feed"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {feedEntries.length ? (
                feedEntries.map((entry) => <LiveMonitorFeedItem key={entry.id} entry={entry} />)
              ) : (
                <p className="text-sm font-semibold text-slate-500">Waiting for live count events.</p>
              )}
            </div>
            <button
              type="button"
              data-testid="admin-live-view-all-logs-button"
              className="border-t border-slate-800 p-4 text-sm font-black text-emerald-400 transition hover:bg-slate-950 hover:text-emerald-300"
            >
              View All Logs
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}

function LiveMonitorChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-slate-800 bg-slate-900 px-3 py-2">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <span className="text-[10px] font-black uppercase tracking-normal text-slate-300">{label}</span>
    </div>
  );
}

function LiveMonitorMetric({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  suffix: string;
  icon: typeof Activity;
  tone: "slate" | "red";
  progress?: number;
}) {
  const isRed = tone === "red";
  return (
    <div className={cx("flex min-h-32 flex-col justify-between border p-5", isRed ? "border-red-900/50 bg-red-950/20" : "border-slate-800 bg-slate-900")}>
      <div className="flex items-start justify-between gap-3">
        <span className={cx("text-sm font-semibold", isRed ? "text-red-300" : "text-slate-400")}>{label}</span>
        <Icon className={cx("h-5 w-5", isRed ? "text-red-400" : "text-slate-400")} />
      </div>
      {progress === undefined ? (
        <div className="flex items-baseline gap-2">
          <span className={cx("font-mono text-4xl font-black", isRed ? "text-red-300" : "text-white")}>{value}</span>
          <span className={cx("text-sm font-semibold", isRed ? "text-red-400" : "text-slate-500")}>{suffix}</span>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex justify-between">
            <span className="text-[10px] font-black uppercase tracking-normal text-slate-400">{suffix}</span>
            <span className="text-sm font-black text-white">{value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function LiveMonitorAlert({
  alert,
}: {
  alert: { id: string; tone: "red" | "amber" | "emerald"; title: string; code: string; description: string; time: string };
}) {
  const classes = {
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    emerald: "border-l-emerald-500",
  };
  return (
    <div className={cx("flex flex-col justify-between gap-3 border border-l-4 border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-start", classes[alert.tone])}>
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-black text-white">{alert.title}</span>
          <span className="rounded-sm border border-slate-700 bg-slate-800 px-2 py-1 text-[8px] font-black uppercase tracking-normal text-slate-400">
            {alert.code}
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-400">{alert.description}</p>
      </div>
      <span className="shrink-0 font-mono text-sm text-slate-500">{alert.time}</span>
    </div>
  );
}

function LiveMonitorFeedItem({
  entry,
}: {
  entry: { id: string; tone: "emerald" | "red" | "amber"; title: string; action: string; meta: string; detail: string; time: string };
}) {
  const dotClass = {
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="flex items-start gap-3">
      <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClass[entry.tone])} />
      <div className="min-w-0">
        <p className="text-sm text-slate-300">
          <span className="font-black text-white">{entry.title}</span> {entry.action}
        </p>
        {entry.detail ? (
          <p className="mt-1 inline-block rounded-sm border border-red-900/50 bg-red-950/30 px-1 text-xs font-semibold text-red-300">
            {entry.detail}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{entry.time}</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span>{entry.meta}</span>
        </div>
      </div>
    </div>
  );
}

function AdminMetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="border border-[#444749] bg-[#122131] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-normal text-[#c4c7c9]">{label}</p>
        <Icon className="h-4 w-4 text-[#bec6e0]" />
      </div>
      <p className="font-mono text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function AdminCompactStat({ label, value, tone }: { label: string; value: string; tone: "red" | "amber" | "emerald" }) {
  const classes = {
    red: "border-red-300/30 bg-red-950 text-red-200",
    amber: "border-amber-300/30 bg-amber-950 text-amber-200",
    emerald: "border-emerald-300/30 bg-emerald-950 text-emerald-200",
  };
  return (
    <div className={cx("border p-3", classes[tone])}>
      <p className="text-[10px] font-black uppercase tracking-normal opacity-80">{label}</p>
      <p className="mt-1 font-mono text-xl font-black">{value}</p>
    </div>
  );
}
