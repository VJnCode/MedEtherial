import type { Role } from '@medetherial/shared';
import { toPoint } from '@medetherial/shared';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type KeyLike } from 'jose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { clearAuthCache } from '../src/auth/context.js';
import { createVerifier, setVerifier } from '../src/auth/verifier.js';
import { syncIndexes } from '../src/db.js';
import { Ambulance, Doctor, Hospital, User } from '../src/models/index.js';

const ISSUER = 'https://auth.test.local/realms/medetherial';
let privateKey: KeyLike;
let mongo: MongoMemoryServer;

export const app = createApp();

export function useTestEnvironment() {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await syncIndexes();

    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' };
    setVerifier(createVerifier({ issuer: ISSUER, audience: 'medetherial-api', keys: createLocalJWKSet({ keys: [jwk] }) }));
  });

  beforeEach(async () => {
    clearAuthCache();
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(
      collections.filter((c) => !c.collectionName.startsWith('system.')).map((c) => c.deleteMany({})),
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

export interface TestUser {
  sub: string;
  name: string;
  roles: Role[];
}

export function makeUser(roles: Role[], name = 'Test User'): TestUser {
  return { sub: randomUUID(), name, roles };
}

export async function tokenFor(
  u: TestUser,
  opts: { audience?: string; expiresIn?: string; claims?: Record<string, unknown> } = {},
) {
  return new SignJWT({
    name: u.name,
    email: `${u.sub.slice(0, 8)}@test.local`,
    ...opts.claims,
    realm_access: { roles: [...u.roles, 'offline_access'] },
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject(u.sub)
    .setIssuer(ISSUER)
    .setAudience(opts.audience ?? 'medetherial-api')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '5m')
    .sign(privateKey);
}

export const bearer = async (u: TestUser) => ({ Authorization: `Bearer ${await tokenFor(u)}` });

/** Creates the Mongo mirror of a user (normally done just-in-time on first request). */
export async function persistUser(u: TestUser, extra: Record<string, unknown> = {}) {
  return User.create({ sub: u.sub, name: u.name, roles: u.roles, ...extra });
}

export async function createHospital(name: string, at: { lat: number; lng: number }, extra: Record<string, unknown> = {}) {
  return Hospital.create({
    name,
    address: 'Test',
    phone: '000',
    location: toPoint(at),
    erBedsTotal: 10,
    erBedsAvailable: 5,
    ...extra,
  });
}

export async function createAmbulance(callsign: string, type: 'ALS' | 'BLS', at: { lat: number; lng: number }, extra: Record<string, unknown> = {}) {
  return Ambulance.create({ callsign, type, plate: callsign, location: toPoint(at), status: 'available', ...extra });
}

export const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, start: '00:00', end: '23:30' }));

export async function createDoctor(u: TestUser, extra: Record<string, unknown> = {}) {
  const user = await persistUser(u);
  return Doctor.create({ user: user._id, specialty: 'Cardiology', availability: ALL_WEEK, ...extra });
}
