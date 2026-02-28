import { env } from "./env";

type PracticeTracePayload = Record<string, unknown> & {
  event: string;
  durationMs?: number;
};

type PracticeTraceSink = (payload: PracticeTracePayload, message: string) => void;

let practiceTraceSink: PracticeTraceSink | null = null;

export function setPracticeTraceSink(sink: PracticeTraceSink | null) {
  practiceTraceSink = sink;
}

export function tracePractice(payload: PracticeTracePayload) {
  if (!practiceTraceSink) return;
  if ((payload.durationMs ?? 0) < env.PRACTICE_TRACE_SLOW_MS) return;
  practiceTraceSink(payload, `practice trace: ${payload.event}`);
}
