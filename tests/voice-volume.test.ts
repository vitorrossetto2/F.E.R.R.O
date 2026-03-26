import { describe, it, expect, vi } from "vitest";

vi.mock("dotenv/config", () => ({}));
vi.mock("say", () => ({ default: { speak: vi.fn() } }));

describe("scaleWavVolume", () => {
  it("scales PCM samples by volume factor", async () => {
    const { scaleWavVolume } = await import("../src/core/voice.js");
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(44 + 4 - 8, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24);
    header.writeUInt32LE(32000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(4, 40);

    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(10000, 0);
    pcm.writeInt16LE(-10000, 2);

    const wav = Buffer.concat([header, pcm]);
    const scaled = scaleWavVolume(wav, 0.5);

    expect(scaled.readInt16LE(44)).toBe(5000);
    expect(scaled.readInt16LE(46)).toBe(-5000);
  });

  it("returns input unchanged when volume is 1.0", async () => {
    const { scaleWavVolume } = await import("../src/core/voice.js");
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.write("data", 36);
    header.writeUInt32LE(4, 40);
    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(10000, 0);
    pcm.writeInt16LE(-10000, 2);
    const wav = Buffer.concat([header, pcm]);

    const result = scaleWavVolume(wav, 1.0);
    expect(result.readInt16LE(44)).toBe(10000);
  });
});
