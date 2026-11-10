"use client";

import { useEffect, useState } from "react";

export function useNewsfeedRelease(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void fetch("/api/newsfeed/config", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json() as Promise<{ enabled?: boolean }>)
      .then((data) => {
        if (isCurrent) {
          setEnabled(data.enabled === true);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setEnabled(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return enabled;
}
