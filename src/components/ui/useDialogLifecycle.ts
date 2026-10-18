import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';
import { isTopDialog, registerDialog } from './dialogLifecycle';

export const DialogParentContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useDialogLifecycle(isOpen: boolean, options: {
  onClose: () => void;
  closeDisabled?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const parentRoot = useContext(DialogParentContext);
  const latest = useRef(options);
  latest.current = options;
  const opener = useRef<HTMLElement | null>(null);
  const opened = useRef(false);
  if (isOpen && !opened.current && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement | null;
  opened.current = isOpen;
  useEffect(() => {
    if (!isOpen || !rootRef.current || !panelRef.current) return;
    return registerDialog({
      root: rootRef.current, panel: panelRef.current, opener: opener.current, parentRoot: parentRoot?.current,
      initialFocus: () => latest.current.initialFocusRef?.current || null,
      dismiss: () => latest.current.onClose(),
      canDismiss: () => !latest.current.closeDisabled && latest.current.closeOnEscape !== false,
    });
  }, [isOpen]);
  const requestClose = () => {
    if (!latest.current.closeDisabled && rootRef.current && isTopDialog(rootRef.current)) latest.current.onClose();
  };
  return { rootRef, panelRef, requestClose };
}
