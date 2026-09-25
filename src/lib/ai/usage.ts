import type { AiUsage } from "@/lib/ai/provider";
import { captureServerEvent, postHogDistinctId } from "@/lib/posthog-server";

/**
 * Sends one model call's token counts to PostHog as `ai_generation`, on the
 * browser's own person where the request carried it, so spend per book (and
 * per converted book) can be read straight off the funnel.
 */
export async function recordAiUsage(request: Request, usage: AiUsage): Promise<void> {
  await captureServerEvent(postHogDistinctId(request, "server"), "ai_generation", {
    kind: usage.kind,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    thinking_tokens: usage.thinkingTokens,
    images: usage.images,
  });
}
