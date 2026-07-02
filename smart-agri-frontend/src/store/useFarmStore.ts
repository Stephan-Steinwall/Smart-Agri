import { create } from 'zustand';

interface FarmState {
    activeFieldId: string | null;
    activeFieldName: string;
    setActiveField: (id: string, name: string) => void;
}

export const useFarmStore = create<FarmState>((set) => ({
    // IMPORTANT: Paste your actual Tomato Field UUID here so it loads by default
    activeFieldId: 'YOUR-FIELD-A-UUID',
    activeFieldName: 'Field A - Tomatoes',

    // The action to update the state
    setActiveField: (id, name) => set({ activeFieldId: id, activeFieldName: name }),
}));