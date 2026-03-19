import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";

// Initialize storage with your group ID
const storage = new ExtensionStorage(
  "group.com.vantage.airecruitment"
);

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  React.useEffect(() => {
    // set widget_state to null if we want to reset the widget
    // storage.set("widget_state", null);

    // Refresh widget (iOS only)
    if (Platform.OS === "ios") {
      ExtensionStorage.reloadWidget();
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (Platform.OS === "ios") {
      ExtensionStorage.reloadWidget();
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
