/**
 * useAppState — tracks app foreground/background transitions.
 *
 * Returns current AppState and fires callbacks when:
 * - App goes to background (user switches away)
 * - App comes back to foreground (user returns)
 *
 * Used to pause/resume game connections and timers.
 */

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

interface UseAppStateOptions {
  onForeground?: () => void;
  onBackground?: () => void;
}

export function useAppState(options?: UseAppStateOptions) {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const prevState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        prevState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        options?.onForeground?.();
      }

      if (
        prevState.current === "active" &&
        nextState.match(/inactive|background/)
      ) {
        options?.onBackground?.();
      }

      prevState.current = nextState;
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, [options]);

  return appState;
}
