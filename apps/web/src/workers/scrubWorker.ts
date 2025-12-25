import { scrubText, type ScrubOptions } from "@pii-scrubber/core";

export type WorkerRequest = {
  text: string;
  options: ScrubOptions;
};

export type WorkerResponse =
  | { ok: true; result: ReturnType<typeof scrubText> }
  | { ok: false; error: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { text, options } = event.data;
  try {
    const result = scrubText(text, options);
    self.postMessage({ ok: true, result } satisfies WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    self.postMessage({ ok: false, error: message } satisfies WorkerResponse);
  }
};
