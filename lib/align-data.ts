import { createHash, randomBytes, timingSafeEqual } from "crypto";

export type Role = "counter" | "financier" | "admin";
export type MeasureType = "quantity" | "volume" | "weight";
export type CountStatus = "pending" | "matching" | "discrepancy" | "locked" | "validated";

export type CountMap = Partial<Record<MeasureType, number>>;

export type ApiUser = {
  username: string;
  fullName: string;
  role: Role;
  group: string;
  locked: boolean;
};

export type ApiReference = {
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

export type ApiAuditEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  ip: string;
  severity: "info" | "warning" | "critical";
};

type StoredUser = ApiUser & {
  passwordHash: string;
};

type DemoStore = {
  users: StoredUser[];
  references: ApiReference[];
  audit: ApiAuditEntry[];
  nextAuditId: number;
};

declare global {
  // eslint-disable-next-line no-var
  var alignDemoStore: DemoStore | undefined;
}

export const measureTypes: MeasureType[] = ["quantity", "volume", "weight"];

export const measureUnits: Record<MeasureType, string> = {
  quantity: "pcs",
  volume: "L",
  weight: "kg",
};

const groupNames = ["Group A", "Group B", "Group C"];

const seedReferences: ApiReference[] = [
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

const seedUsers: ApiUser[] = [
  { username: "counter", fullName: "Maya Counter", role: "counter", group: "Group A", locked: false },
  { username: "finance", fullName: "Jonas Controller", role: "financier", group: "Control Room", locked: false },
  { username: "admin", fullName: "ALIGN Admin", role: "admin", group: "Supervisor", locked: false },
];

const seedAudit: Array<Omit<ApiAuditEntry, "id">> = [
  {
    timestamp: "2026-06-10 07:42",
    user: "admin",
    action: "Inventory day cycle opened",
    ip: "10.14.2.11",
    severity: "info",
  },
  {
    timestamp: "2026-06-10 08:15",
    user: "finance",
    action: "SAP baseline loaded for ALLER-01",
    ip: "10.14.2.18",
    severity: "info",
  },
  {
    timestamp: "2026-06-10 08:51",
    user: "counter",
    action: "REF-WT-510 locked after third failed attempt",
    ip: "10.14.5.42",
    severity: "warning",
  },
];

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `sha256:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [, salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) {
    return false;
  }
  const actualHash = hashPassword(password, salt).split(":")[2];
  return timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

export function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function formatTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function cloneReference(reference: ApiReference): ApiReference {
  return {
    ...reference,
    required: [...reference.required],
    expected: { ...reference.expected },
    unit: { ...reference.unit },
    lastCount: reference.lastCount ? { ...reference.lastCount } : undefined,
  };
}

function serializeUser(user: StoredUser): ApiUser {
  return {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    group: user.group,
    locked: user.locked,
  };
}

function createInitialStore(): DemoStore {
  return {
    users: seedUsers.map((user) => ({ ...user, passwordHash: hashPassword("align") })),
    references: seedReferences.map(cloneReference),
    audit: seedAudit.map((entry, index) => ({ ...entry, id: `AUD-SEED-${index + 1}` })),
    nextAuditId: seedAudit.length + 1,
  };
}

function store() {
  if (!globalThis.alignDemoStore) {
    globalThis.alignDemoStore = createInitialStore();
  }
  return globalThis.alignDemoStore;
}

function findReference(referenceId: string) {
  return store().references.find((reference) => reference.id === referenceId);
}

export async function ensureSeedData() {
  store();
}

export async function getAppState() {
  const currentStore = store();
  return {
    users: currentStore.users.map(serializeUser).sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username)),
    references: currentStore.references.map(cloneReference).sort((a, b) => a.aller.localeCompare(b.aller) || a.id.localeCompare(b.id)),
    audit: currentStore.audit.slice(0, 150),
  };
}

export async function addAudit(user: string, action: string, severity: ApiAuditEntry["severity"], ip: string) {
  const currentStore = store();
  const entry: ApiAuditEntry = {
    id: `AUD-${currentStore.nextAuditId++}`,
    timestamp: formatTimestamp(new Date()),
    user,
    action,
    ip,
    severity,
  };
  currentStore.audit.unshift(entry);
  return entry;
}

export async function requireActor(username: string | undefined, allowedRoles: Role[]) {
  if (!username) {
    throw new RouteError("Missing actor.", 401);
  }
  const actor = store().users.find((user) => user.username === username);
  if (!actor || actor.locked) {
    throw new RouteError("Actor is missing or locked.", 401);
  }
  if (!allowedRoles.includes(actor.role)) {
    throw new RouteError("Role is not allowed for this action.", 403);
  }
  return actor;
}

export async function loginUser(username: string, password: string, ip: string) {
  const user = store().users.find((candidate) => candidate.username === username);
  if (!user || user.locked || !verifyPassword(password, user.passwordHash)) {
    throw new RouteError("Invalid credentials or locked user.", 401);
  }
  await addAudit(user.username, "Signed in to ALIGN workstation", "info", ip);
  return serializeUser(user);
}

export function numericCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function isMeasureMatch(reference: ApiReference, count: CountMap) {
  return reference.required.every((measure) => {
    const expectedValue = reference.expected[measure];
    const actualValue = count[measure];
    if (expectedValue === undefined || actualValue === undefined || Number.isNaN(actualValue)) {
      return false;
    }
    return Math.abs(expectedValue - actualValue) <= 0.01;
  });
}

export async function submitReferenceCount(actorName: string | undefined, referenceId: string | undefined, count: CountMap | undefined, ip: string) {
  const actor = await requireActor(actorName, ["counter", "admin"]);
  const id = referenceId?.trim();
  if (!id) {
    throw new RouteError("Reference is required.", 400);
  }
  const reference = findReference(id);
  if (!reference) {
    throw new RouteError("Reference not found.", 404);
  }
  if (reference.status === "locked") {
    throw new RouteError("Reference is locked.", 409);
  }
  if (actor.role === "counter" && reference.assignedGroup !== actor.group) {
    throw new RouteError("This reference is assigned to another group.", 403);
  }

  const submittedCount: CountMap = {
    quantity: numericCount(count?.quantity),
    volume: numericCount(count?.volume),
    weight: numericCount(count?.weight),
  };
  const missing = reference.required.some((measure) => submittedCount[measure] === undefined);
  if (missing) {
    throw new RouteError("All required count fields must be submitted.", 400);
  }

  const matched = isMeasureMatch(reference, submittedCount);
  const nextAttempt = matched ? Math.max(reference.attempt, 1) : reference.attempt + 1;
  const nextStatus: CountStatus = matched ? "matching" : nextAttempt >= 3 ? "locked" : "discrepancy";
  reference.lastCount = submittedCount;
  reference.attempt = nextAttempt;
  reference.status = nextStatus;

  await addAudit(
    actor.username,
    `${reference.id} submitted as ${nextStatus} on attempt ${nextAttempt}`,
    nextStatus === "matching" ? "info" : "warning",
    ip,
  );

  return { status: nextStatus, attempt: nextAttempt };
}

export async function validateReference(actorName: string | undefined, referenceId: string | undefined, ip: string) {
  const actor = await requireActor(actorName, ["financier", "admin"]);
  const id = referenceId?.trim();
  if (!id) {
    throw new RouteError("Reference is required.", 400);
  }
  const reference = findReference(id);
  if (!reference) {
    throw new RouteError("Reference not found.", 404);
  }
  reference.status = "validated";
  await addAudit(actor.username, `${id} validated by finance controller`, "info", ip);
}

export async function countAgainReference(actorName: string | undefined, referenceId: string | undefined, ip: string) {
  const actor = await requireActor(actorName, ["financier", "admin"]);
  const id = referenceId?.trim();
  if (!id) {
    throw new RouteError("Reference is required.", 400);
  }
  const reference = findReference(id);
  if (!reference) {
    throw new RouteError("Reference not found.", 404);
  }
  const nextGroup = groupNames.find((group) => group !== reference.assignedGroup) ?? "Group A";
  reference.assignedGroup = nextGroup;
  reference.secondGroup = nextGroup;
  reference.status = "pending";
  reference.attempt = 0;
  reference.lastCount = undefined;
  await addAudit(actor.username, `${id} reassigned to ${nextGroup} for count again`, "warning", ip);
  return nextGroup;
}

export async function assignBatch(actorName: string | undefined, aller: string | undefined, group: string | undefined, ip: string) {
  const actor = await requireActor(actorName, ["financier", "admin"]);
  const normalizedAller = aller?.trim().toUpperCase();
  const normalizedGroup = group?.trim();
  if (!normalizedAller || !normalizedGroup) {
    throw new RouteError("Aller and assignment group are required.", 400);
  }
  if (!/^Group [A-Z]$/.test(normalizedGroup)) {
    throw new RouteError("Assignment group must be a counter group.", 400);
  }
  let updated = 0;
  for (const reference of store().references) {
    if (reference.aller === normalizedAller) {
      reference.assignedGroup = normalizedGroup;
      updated += 1;
    }
  }
  await addAudit(actor.username, `${normalizedAller} assigned to ${normalizedGroup} by finance`, "info", ip);
  return updated;
}

export async function importReferences(actorName: string | undefined, references: ApiReference[], fileName: string | undefined, ip: string) {
  const actor = await requireActor(actorName, ["financier", "admin"]);
  if (!references.length) {
    throw new RouteError("No SAP rows were provided.", 400);
  }

  let imported = 0;
  for (const reference of references) {
    const id = reference.id?.trim().toUpperCase();
    if (!id) {
      continue;
    }
    const required = reference.required.filter((measure) => measureTypes.includes(measure));
    const current = findReference(id);
    const nextReference: ApiReference = {
      id,
      sku: reference.sku?.trim() || id,
      name: reference.name?.trim() || "SAP Material",
      aller: reference.aller?.trim().toUpperCase() || "ALLER-IMPORT",
      assignedGroup: reference.assignedGroup?.trim() || "Group A",
      required: required.length ? required : ["quantity"],
      expected: { ...reference.expected },
      unit: measureUnits,
      status: current?.status ?? "pending",
      attempt: current?.attempt ?? 0,
      lastCount: current?.lastCount ? { ...current.lastCount } : undefined,
      secondGroup: current?.secondGroup,
    };
    if (current) {
      Object.assign(current, nextReference);
    } else {
      store().references.push(nextReference);
    }
    imported += 1;
  }

  await addAudit(actor.username, `Imported SAP file ${fileName ?? "upload"} with ${imported} rows`, "info", ip);
  return imported;
}

export async function addUser(
  actorName: string | undefined,
  user: { username?: string; fullName?: string; role?: Role; group?: string } | undefined,
  ip: string,
) {
  const actor = await requireActor(actorName, ["admin"]);
  const username = user?.username?.trim().toLowerCase();
  const fullName = user?.fullName?.trim();
  if (!username || !fullName) {
    throw new RouteError("Username and full name are required.", 400);
  }
  if (store().users.some((item) => item.username === username)) {
    throw new RouteError("Username already exists.", 409);
  }
  store().users.push({
    username,
    fullName,
    role: user?.role ?? "counter",
    group: user?.group ?? "Group A",
    locked: false,
    passwordHash: hashPassword("align"),
  });
  await addAudit(actor.username, `Added user ${username}`, "info", ip);
}

export async function updateUser(
  actorName: string | undefined,
  username: string | undefined,
  updates: { role?: Role; group?: string; locked?: boolean } | undefined,
  ip: string,
) {
  const actor = await requireActor(actorName, ["admin"]);
  const normalizedUsername = username?.trim().toLowerCase();
  if (!normalizedUsername) {
    throw new RouteError("Username is required.", 400);
  }
  const user = store().users.find((candidate) => candidate.username === normalizedUsername);
  if (!user) {
    throw new RouteError("User not found.", 404);
  }
  if (updates?.role) user.role = updates.role;
  if (updates?.group) user.group = updates.group;
  if (typeof updates?.locked === "boolean") user.locked = updates.locked;
  await addAudit(actor.username, `Updated user ${normalizedUsername}`, "info", ip);
}

export async function addReference(actorName: string | undefined, reference: ApiReference | undefined, ip: string) {
  const actor = await requireActor(actorName, ["admin"]);
  const id = reference?.id?.trim().toUpperCase();
  if (!reference || !id || !reference.name?.trim()) {
    throw new RouteError("Reference and name are required.", 400);
  }
  if (findReference(id)) {
    throw new RouteError("Reference already exists.", 409);
  }
  const required = reference.required.filter((measure) => measureTypes.includes(measure));
  if (!required.length) {
    throw new RouteError("At least one measure is required.", 400);
  }
  store().references.push({
    id,
    sku: reference.sku?.trim() || id,
    name: reference.name.trim(),
    aller: reference.aller?.trim().toUpperCase() || "ALLER-01",
    assignedGroup: reference.assignedGroup || "Group A",
    required,
    expected: { ...reference.expected },
    unit: measureUnits,
    status: "pending",
    attempt: 0,
  });
  await addAudit(actor.username, `Added reference ${id}`, "info", ip);
}

export async function updateReference(
  actorName: string | undefined,
  referenceId: string | undefined,
  updates: { status?: string; attempt?: number } | undefined,
  ip: string,
) {
  const actor = await requireActor(actorName, ["admin"]);
  const id = referenceId?.trim().toUpperCase();
  if (!id) {
    throw new RouteError("Reference ID is required.", 400);
  }
  const reference = findReference(id);
  if (!reference) {
    throw new RouteError("Reference not found.", 404);
  }

  let changed = false;
  const allowedStatuses: CountStatus[] = ["pending", "matching", "discrepancy", "locked", "validated"];
  if (updates?.status && allowedStatuses.includes(updates.status as CountStatus)) {
    reference.status = updates.status as CountStatus;
    if (reference.status === "pending") {
      reference.secondGroup = undefined;
    }
    changed = true;
  }
  if (typeof updates?.attempt === "number") {
    reference.attempt = Math.max(0, Math.min(3, Math.trunc(updates.attempt)));
    changed = true;
  }
  if (!changed) {
    throw new RouteError("No reference updates were provided.", 400);
  }

  await addAudit(actor.username, `Updated reference ${id} from admin override`, "warning", ip);
}

export async function resetDay(actorName: string | undefined, ip: string) {
  const actor = await requireActor(actorName, ["admin"]);
  for (const reference of store().references) {
    reference.status = "pending";
    reference.attempt = 0;
    reference.lastCount = undefined;
    reference.secondGroup = undefined;
  }
  await addAudit(actor.username, "Day reset completed and temporary locks cleared", "critical", ip);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export class RouteError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function jsonErrorFrom(error: unknown, fallbackMessage: string, fallbackStatus = 500) {
  if (error instanceof RouteError) {
    return jsonError(error.message, error.status);
  }
  return jsonError(error instanceof Error ? error.message : fallbackMessage, fallbackStatus);
}
