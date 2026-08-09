import type { WorkletAttachMessage, WorkletCreditMessage, WorkerFrameMessage } from "../workerProtocol";

declare const sampleRate: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, processorCtor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor): void;

const PROCESSOR_NAME = "musica-mathematica-capture";

function isWorkletAttachMessage(message: unknown): message is WorkletAttachMessage {
  return typeof message === "object"
    && message !== null
    && (message as { type?: unknown }).type === "attach-output";
}

function isWorkletCreditMessage(message: unknown): message is WorkletCreditMessage {
  return typeof message === "object"
    && message !== null
    && (message as { type?: unknown }).type === "credits";
}

class CaptureProcessor extends AudioWorkletProcessor {
  private readonly frameSize: 2048 | 4096;
  private readonly hopSize: number;
  private readonly ring: Float32Array;
  private outputPort: MessagePort | null = null;
  private ringIndex = 0;
  private sampleCount = 0;
  private sequence = 0;
  private credits = 0;
  private droppedFrames = 0;

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    const requestedFrameSize = options.processorOptions?.frameSize;
    this.frameSize = requestedFrameSize === 4096 ? 4096 : 2048;
    this.hopSize = this.frameSize / 2;
    this.ring = new Float32Array(this.frameSize);
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkletAttachMessage(event.data)) return;
      this.outputPort = event.data.port;
      this.outputPort.onmessage = (creditEvent: MessageEvent<unknown>) => {
        if (isWorkletCreditMessage(creditEvent.data) && Number.isSafeInteger(creditEvent.data.count)) {
          this.credits += Math.max(0, creditEvent.data.count);
        }
      };
      this.outputPort.start();
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs.at(0)?.at(0);
    if (!channel) return true;
    for (let index = 0; index < channel.length; index += 1) {
      this.captureSample(channel.at(index) ?? 0);
    }
    return true;
  }

  private captureSample(sample: number): void {
    this.ring[this.ringIndex] = sample;
    this.ringIndex = (this.ringIndex + 1) % this.frameSize;
    this.sampleCount += 1;
    if (!this.isFrameReady()) return;
    this.postFrame();
  }

  private isFrameReady(): boolean {
    return this.sampleCount >= this.frameSize && (this.sampleCount - this.frameSize) % this.hopSize === 0;
  }

  private postFrame(): void {
    const sequence = this.sequence;
    this.sequence += 1;
    if (!this.outputPort || this.credits <= 0) {
      this.droppedFrames += 1;
      return;
    }
    const samples = this.copyFrame();
    const message: WorkerFrameMessage = {
      type: "audio-frame",
      frame: {
        sequence,
        startSample: this.sampleCount - this.frameSize,
        sampleRateHz: sampleRate,
        samples,
        droppedBefore: this.droppedFrames,
      },
    };
    this.outputPort.postMessage(message, [samples.buffer]);
    this.credits -= 1;
    this.droppedFrames = 0;
  }

  private copyFrame(): Float32Array {
    const samples = new Float32Array(this.frameSize);
    const tailLength = this.frameSize - this.ringIndex;
    samples.set(this.ring.subarray(this.ringIndex));
    if (this.ringIndex > 0) {
      samples.set(this.ring.subarray(0, this.ringIndex), tailLength);
    }
    return samples;
  }
}

registerProcessor(PROCESSOR_NAME, CaptureProcessor);
