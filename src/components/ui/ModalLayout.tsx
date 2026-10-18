import { useId, type ReactNode, type ButtonHTMLAttributes } from 'react';
import './ModalLayout.css';

export function ModalFieldGrid({ children }: { children: ReactNode }) {
  return <div className="shared-modal-field-grid">{children}</div>;
}
export function ModalFullWidth({ children }: { children: ReactNode }) {
  return <div className="shared-modal-full-width">{children}</div>;
}
export function ModalSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = useId();
  return <section className="shared-modal-section" aria-labelledby={id}>
    <h4 id={id}>{title}</h4>{description ? <p>{description}</p> : null}{children}
  </section>;
}
export function ModalMediaSplit({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  return <div className="shared-modal-media-split"><div>{children}</div><div>{preview}</div></div>;
}
/** Associates a persistent-footer action with an existing body form; never nests forms. */
export function ModalSubmitButton({ formId, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'form' | 'type'> & { formId: string }) {
  return <button {...props} type="submit" form={formId} />;
}
