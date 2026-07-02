import { create } from 'zustand';

interface FarmState {
    activeFieldId: string | null;
    activeFieldName: string;
    setActiveField: (id: string, name: string) => void;
}

export const useFarmStore = create<FarmState>((set) => ({
    // Starts as null — FieldSelector auto-populates it from the backend
    activeFieldId: null,
    activeFieldName: '',

    setActiveField: (id, name) => set({ activeFieldId: id, activeFieldName: name }),
}));