import { Eye, EyeOff } from "lucide-react";

export function AdminPasswordField({ value, onChange, visible, onToggle, label, showLabel, hideLabel, id = "admin-member-password" }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  label: string;
  showLabel: string;
  hideLabel: string;
}) {
  return <div className="space-y-2">
    <label htmlFor={id} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="admin-password-field">
      <input id={id} required type={visible ? "text" : "password"} autoComplete="new-password" minLength={8}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm transition-all"
        value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="admin-password-toggle" aria-controls={id} aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel} title={visible ? hideLabel : showLabel} onClick={onToggle}>
        {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
      </button>
    </div>
  </div>;
}
