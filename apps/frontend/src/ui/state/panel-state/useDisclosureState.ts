import { useState } from "react";

export function useDisclosureState(initialOpen = true): {
  isOpen: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return {
    isOpen,
    setOpen: (next) => setIsOpen(next),
    toggle: () => setIsOpen((current) => !current),
  };
}

export function useGroupedDisclosureState(
  initialOpen = true,
): {
  isOpen: (key: string) => boolean;
  setOpen: (key: string, next: boolean) => void;
  toggle: (key: string) => void;
} {
  const [openByKey, setOpenByKey] = useState<Record<string, boolean>>({});

  return {
    isOpen: (key) => openByKey[key] ?? initialOpen,
    setOpen: (key, next) =>
      setOpenByKey((current) => ({
        ...current,
        [key]: next,
      })),
    toggle: (key) =>
      setOpenByKey((current) => ({
        ...current,
        [key]: !(current[key] ?? initialOpen),
      })),
  };
}
