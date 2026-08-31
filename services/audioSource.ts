import type { AudioSource, AudioSourceHandlers } from '@soniox/client';

/**
 * Echo cancellation is on because this source can also carry system audio: without
 * it the far end would be transcribed twice (once from the tab, once via speakers).
 */
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

const TIMESLICE_MS = 60;

export class SystemAudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemAudioUnavailableError';
  }
}

/**
 * AudioSource that mixes the microphone with optional system/tab audio
 * through a Web Audio graph, so remote participants are transcribed too.
 */
export class MixedAudioSource implements AudioSource {
  private context: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micStream: MediaStream | null = null;
  private micGain: GainNode | null = null;
  private systemStream: MediaStream | null = null;
  private systemNode: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;
  private handlers: AudioSourceHandlers | null = null;
  private stopped = false;

  /** Called when the person ends screen sharing from the browser's own bar. */
  onSystemAudioEnded?: () => void;

  async start(handlers: AudioSourceHandlers): Promise<void> {
    this.handlers = handlers;
    this.stopped = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Bu brauzer mikrofonga kirishni qo‘llab-quvvatlamaydi.');
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Bu brauzer MediaRecorder’ni qo‘llab-quvvatlamaydi.');
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });

    const AudioCtx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtx();
    if (this.context.state === 'suspended') await this.context.resume();

    this.destination = this.context.createMediaStreamDestination();
    this.micGain = this.context.createGain();
    this.context.createMediaStreamSource(this.micStream).connect(this.micGain);
    this.micGain.connect(this.destination);

    this.startRecorder();
  }

  private startRecorder() {
    if (!this.destination) return;
    const recorder = new MediaRecorder(this.destination.stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      event.data.arrayBuffer().then(
        (buffer) => this.handlers?.onData(buffer),
        (error) => this.handlers?.onError(error instanceof Error ? error : new Error(String(error))),
      );
    };
    recorder.onerror = (event) => {
      const message = (event as unknown as { error?: DOMException }).error?.message ?? 'MediaRecorder xatosi';
      this.handlers?.onError(new Error(message));
    };
    recorder.start(TIMESLICE_MS);
    this.recorder = recorder;
  }

  /** Mute the microphone without tearing down the session or muting system audio. */
  setMicEnabled(enabled: boolean) {
    if (this.micGain && this.context) {
      this.micGain.gain.setValueAtTime(enabled ? 1 : 0, this.context.currentTime);
    }
  }

  get hasSystemAudio(): boolean {
    return this.systemStream !== null;
  }

  /**
   * Ask for a screen/tab/window share and mix in its audio track.
   * The video track is kept alive because browsers end the capture session
   * once every track from getDisplayMedia has stopped.
   */
  async enableSystemAudio(): Promise<void> {
    if (this.systemStream) return;
    if (!this.context || !this.destination) {
      throw new SystemAudioUnavailableError('Yozib olish hali boshlanmadi.');
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new SystemAudioUnavailableError('Bu brauzer tizim ovozini olishni qo‘llab-quvvatlamaydi.');
    }

    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const audioTracks = display.getAudioTracks();
    if (audioTracks.length === 0) {
      display.getTracks().forEach((track) => track.stop());
      throw new SystemAudioUnavailableError(
        'Ovoz ulashilmadi. Ekranni tanlashda “Share tab audio” yoki “Share system audio” bandini belgilang.',
      );
    }

    this.systemStream = display;
    this.systemNode = this.context.createMediaStreamSource(new MediaStream(audioTracks));
    this.systemNode.connect(this.destination);

    const handleEnded = () => {
      if (this.stopped) return;
      this.disableSystemAudio();
      this.onSystemAudioEnded?.();
    };
    display.getTracks().forEach((track) => track.addEventListener('ended', handleEnded, { once: true }));
  }

  disableSystemAudio() {
    this.systemNode?.disconnect();
    this.systemNode = null;
    this.systemStream?.getTracks().forEach((track) => track.stop());
    this.systemStream = null;
  }

  stop(): void {
    this.stopped = true;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.ondataavailable = null;
      this.recorder.onerror = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.disableSystemAudio();
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.micGain = null;
    this.destination = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.handlers = null;
  }

  pause(): void {
    if (this.recorder?.state === 'recording') this.recorder.pause();
  }

  resume(): void {
    if (this.recorder?.state === 'paused') this.recorder.resume();
  }

  /** Reconnection needs a fresh container header, so rebuild the recorder. */
  restart(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.ondataavailable = null;
      this.recorder.onerror = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.startRecorder();
  }
}
