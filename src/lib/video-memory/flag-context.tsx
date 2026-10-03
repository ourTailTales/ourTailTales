"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether Video Memories are switched on, for client components.
 *
 * The flag itself is a server-side environment variable
 * (`videoMemoriesEnabled()` in `flag.ts`). A server component reads it and
 * hands it down through this provider, so the answer is there on first render
 * with no request and no flash of a tab that is about to disappear. Off for
 * anything rendered outside a provider.
 */
const VideoMemoriesFlagContext = createContext(false);

export function VideoMemoriesFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <VideoMemoriesFlagContext.Provider value={enabled}>
      {children}
    </VideoMemoriesFlagContext.Provider>
  );
}

export function useVideoMemoriesEnabled(): boolean {
  return useContext(VideoMemoriesFlagContext);
}
