import {getStorage} from "firebase-admin/storage";
import {describe, expect, it} from "vitest";
import {EmulatorFileStorage} from "../../../../../src/document/infrastructure/storage/emulator-file-storage.js";
import {testApp} from "../../../../../src/shared/infrastructure/testing/helpers.js";

const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const bucket = getStorage(testApp()).bucket(
  "demo-escuelas-integration.appspot.com",
);
const storage = new EmulatorFileStorage(bucket, host ?? "", () => "up-it-1");
const expiresAt = new Date("2026-10-08T12:15:00Z");
const BODY = Buffer.from("%PDF-1.4 fake pdf body");

describe("EmulatorFileStorage (Storage emulator)", () => {
  it("runs the flow: upload with the ticket, stat, move, download", async () => {
    expect(host).toBeTruthy();

    const ticket = await storage.createUpload({
      tenantId: "t1",
      contentType: "application/pdf",
      size: BODY.length,
      expiresAt,
    });
    expect(ticket.uploadId).toBe("up-it-1");
    expect(ticket.uploadMethod).toBe("POST");
    expect(ticket.uploadHeaders["Content-Type"]).toBe("application/pdf");

    const uploaded = await fetch(ticket.uploadUrl, {
      method: ticket.uploadMethod,
      headers: ticket.uploadHeaders,
      body: BODY,
    });
    expect(uploaded.ok).toBe(true);

    const pending = "uploads/t1/up-it-1";
    const stored = await storage.stat(pending);
    expect(stored).toMatchObject({
      contentType: "application/pdf",
      size: BODY.length,
    });
    expect(stored!.createdAt).toBeInstanceOf(Date);

    const final = "tenants/t1/players/p1/documents/up-it-1";
    await storage.move(pending, final);
    expect(await storage.stat(pending)).toBeNull();
    expect((await storage.stat(final))!.size).toBe(BODY.length);

    const link = await storage.createDownloadUrl({path: final, expiresAt});
    expect(link.expiresAt).toEqual(expiresAt);
    const downloaded = await fetch(link.url);
    expect(downloaded.ok).toBe(true);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(BODY);
  });

  it("returns null for an object that does not exist", async () => {
    expect(await storage.stat("uploads/t1/nope")).toBeNull();
  });
});
