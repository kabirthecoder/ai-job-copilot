import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 120_000;

type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

type StoredSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

async function ensureDataFile(filePath: string) {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "[]", "utf8");
  }
}

async function readJsonFile<T>(filePath: string): Promise<T[]> {
  await ensureDataFile(filePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T[];
}

async function writeJsonFile<T>(filePath: string, value: T[]) {
  await ensureDataFile(filePath);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 64, "sha256").toString("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function registerUser(name: string, email: string, password: string) {
  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");

  if (cleanName.length < 2) {
    throw new Error("Enter your full name.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Enter a valid email address.");
  }

  if (cleanPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const users = await readJsonFile<StoredUser>(USERS_FILE);
  if (users.some((user) => user.email === cleanEmail)) {
    throw new Error("An account with that email already exists.");
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: `user_${Date.now()}_${randomBytes(6).toString("hex")}`,
    name: cleanName,
    email: cleanEmail,
    passwordSalt: salt,
    passwordHash: hashPassword(cleanPassword, salt),
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeJsonFile(USERS_FILE, users);

  return sanitizeUser(user);
}

export async function authenticateUser(email: string, password: string) {
  const cleanEmail = normalizeEmail(email);
  const users = await readJsonFile<StoredUser>(USERS_FILE);
  const user = users.find((entry) => entry.email === cleanEmail);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordHash = hashPassword(String(password || ""), user.passwordSalt);
  if (!safeEqualHex(passwordHash, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  return sanitizeUser(user);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const sessions = await readJsonFile<StoredSession>(SESSIONS_FILE);
  const nextSessions = sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());

  nextSessions.push({
    id: `session_${Date.now()}_${randomBytes(6).toString("hex")}`,
    userId,
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  });

  await writeJsonFile(SESSIONS_FILE, nextSessions);
  return token;
}

export async function revokeSession(token: string) {
  if (!token) return;
  const sessions = await readJsonFile<StoredSession>(SESSIONS_FILE);
  const tokenHash = hashToken(token);
  await writeJsonFile(
    SESSIONS_FILE,
    sessions.filter((session) => session.tokenHash !== tokenHash)
  );
}

export async function getUserFromSession(token: string) {
  if (!token) return null;

  const [users, sessions] = await Promise.all([
    readJsonFile<StoredUser>(USERS_FILE),
    readJsonFile<StoredSession>(SESSIONS_FILE)
  ]);

  const tokenHash = hashToken(token);
  const session = sessions.find(
    (entry) =>
      entry.tokenHash === tokenHash &&
      new Date(entry.expiresAt).getTime() > Date.now()
  );

  if (!session) {
    return null;
  }

  const user = users.find((entry) => entry.id === session.userId);
  return user ? sanitizeUser(user) : null;
}
