import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { AuditEntry, InventoryReference, User } from "@prisma/client";
import { prisma } from "./db";

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

export const measureTypes: MeasureType[] = ["quantity", "volume", "weight"];

export const measureUnits: Record<MeasureType, string> = {
  quantity: "pcs",
  volume: "L",
  weight: "kg",
};

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

export function parseTimestamp(value: string) {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function serializeUser(user: User): ApiUser {
  return {
    username: user.username,
    fullName: user.fullName,
    role: user.role as Role,
    group: user.groupName,
    locked: user.locked,
  };
}

export function serializeReference(reference: InventoryReference): ApiReference {
  const required = reference.requiredMeasures
    .split(",")
    .filter((measure): measure is MeasureType => measureTypes.includes(measure as MeasureType));
  const expected: CountMap = {
    quantity: reference.expectedQuantity ?? undefined,
    volume: reference.expectedVolume ?? undefined,
    weight: reference.expectedWeight ?? undefined,
  };
  const lastCount: CountMap = {
    quantity: reference.countQuantity ?? undefined,
    volume: reference.countVolume ?? undefined,
    weight: reference.countWeight ?? undefined,
  };
  const hasLastCount = Object.values(lastCount).some((value) => value !== undefined);
  return {
    id: reference.id,
    sku: reference.sku,
    name: reference.name,
    aller: reference.aller,
    assignedGroup: reference.assignedGroup,
    required,
    expected,
    unit: measureUnits,
    status: reference.status as CountStatus,
    attempt: reference.attempt,
    lastCount: hasLastCount ? lastCount : undefined,
    secondGroup: reference.secondGroup ?? undefined,
  };
}

export function serializeAudit(entry: AuditEntry): ApiAuditEntry {
  return {
    id: entry.id,
    timestamp: formatTimestamp(entry.timestamp),
    user: entry.user,
    action: entry.action,
    ip: entry.ip,
    severity: entry.severity as ApiAuditEntry["severity"],
  };
}

export function referenceToDatabaseInput(reference: ApiReference) {
  return {
    id: reference.id,
    sku: reference.sku,
    name: reference.name,
    aller: reference.aller,
    assignedGroup: reference.assignedGroup,
    requiredMeasures: reference.required.join(","),
    expectedQuantity: reference.expected.quantity ?? null,
    expectedVolume: reference.expected.volume ?? null,
    expectedWeight: reference.expected.weight ?? null,
    countQuantity: reference.lastCount?.quantity ?? null,
    countVolume: reference.lastCount?.volume ?? null,
    countWeight: reference.lastCount?.weight ?? null,
    status: reference.status,
    attempt: reference.attempt,
    secondGroup: reference.secondGroup ?? null,
  };
}

export function isMeasureMatch(reference: InventoryReference, count: CountMap) {
  const required = reference.requiredMeasures
    .split(",")
    .filter((measure): measure is MeasureType => measureTypes.includes(measure as MeasureType));
  const expected: CountMap = {
    quantity: reference.expectedQuantity ?? undefined,
    volume: reference.expectedVolume ?? undefined,
    weight: reference.expectedWeight ?? undefined,
  };
  return required.every((measure) => {
    const expectedValue = expected[measure];
    const actualValue = count[measure];
    if (expectedValue === undefined || actualValue === undefined || Number.isNaN(actualValue)) {
      return false;
    }
    return Math.abs(expectedValue - actualValue) <= 0.01;
  });
}

export async function ensureSeedData() {
  const [userCount, referenceCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.inventoryReference.count(),
    prisma.auditEntry.count(),
  ]);

  if (userCount === 0) {
    await prisma.user.createMany({
      data: seedUsers.map((user) => ({
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        groupName: user.group,
        locked: user.locked,
        passwordHash: hashPassword("align"),
      })),
    });
  }

  if (referenceCount === 0) {
    await prisma.inventoryReference.createMany({
      data: seedReferences.map(referenceToDatabaseInput),
    });
  }

  if (auditCount === 0) {
    await prisma.auditEntry.createMany({
      data: seedAudit.map((entry) => ({
        ...entry,
        timestamp: parseTimestamp(entry.timestamp),
      })),
    });
  }
}

export async function getAppState() {
  await ensureSeedData();
  const [users, references, audit] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { username: "asc" }] }),
    prisma.inventoryReference.findMany({ orderBy: [{ aller: "asc" }, { id: "asc" }] }),
    prisma.auditEntry.findMany({ orderBy: { timestamp: "desc" }, take: 150 }),
  ]);
  return {
    users: users.map(serializeUser),
    references: references.map(serializeReference),
    audit: audit.map(serializeAudit),
  };
}

export async function addAudit(user: string, action: string, severity: ApiAuditEntry["severity"], ip: string) {
  return prisma.auditEntry.create({
    data: {
      user,
      action,
      severity,
      ip,
    },
  });
}

export async function requireActor(username: string | undefined, allowedRoles: Role[]) {
  if (!username) {
    throw new RouteError("Missing actor.", 401);
  }
  const actor = await prisma.user.findUnique({ where: { username } });
  if (!actor || actor.locked) {
    throw new RouteError("Actor is missing or locked.", 401);
  }
  if (!allowedRoles.includes(actor.role as Role)) {
    throw new RouteError("Role is not allowed for this action.", 403);
  }
  return actor;
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
