import { create } from "zustand";

interface FixResult {
  type: "send" | "parse" | "sessions" | "validate";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface FixState {
  // Inputs
  msgType: string;
  fields: Record<string, string>;
  rawMessage: string;
  version: string;

  // Output
  result: FixResult | null;
  loading: boolean;

  // Setters
  setMsgType: (msgType: string) => void;
  setFields: (fields: Record<string, string>) => void;
  setField: (key: string, value: string) => void;
  setRawMessage: (rawMessage: string) => void;
  setVersion: (version: string) => void;
  setResult: (result: FixResult | null) => void;
  setLoading: (loading: boolean) => void;

  // Actions
  reset: () => void;
}

const initialState = {
  msgType: "NewOrderSingle",
  fields: {},
  rawMessage: "",
  version: "FIX.4.4",
  result: null,
  loading: false,
};

export const useFixStore = create<FixState>((set) => ({
  ...initialState,

  setMsgType: (msgType) => set({ msgType }),
  setFields: (fields) => set({ fields }),
  setField: (key, value) =>
    set((state) => ({ fields: { ...state.fields, [key]: value } })),
  setRawMessage: (rawMessage) => set({ rawMessage }),
  setVersion: (version) => set({ version }),
  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),

  reset: () => set(initialState),
}));
