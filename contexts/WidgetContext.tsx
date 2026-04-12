import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appleTargets = Platform.OS === "ios" ? (() => { try { return require("@bacons/apple-targets"); } catch { return null; } })() : null;

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (Platform.OS === "ios" && appleTargets) {
      try {
        appleTargets.ExtensionStorage.reloadWidget();
      } catch (e) {
        // ignore — widget not available
      }
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (Platform.OS === "ios" && appleTargets) {
      try {
        appleTargets.ExtensionStorage.reloadWidget();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
