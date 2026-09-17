"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";

export function BookViewAnalytics() {
  useEffect(() => {
    track("free_book_opened");
  }, []);

  return null;
}
