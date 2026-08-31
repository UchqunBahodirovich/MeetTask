import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { AppSettings, Language } from '../types';
import { LANGUAGES, useI18n } from '../i18n';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  onResetData: () => void;
  onManageTeam: () => void;
}

const Toggle: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 mt-0.5 accent-blue-600"
    />
    <span className="text-sm font-medium text-slate-700">
      {label}
      <span className="block text-xs font-normal text-slate-400">{hint}</span>
    </span>
  </label>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  onClose,
  onSave,
  onResetData,
  onManageTeam,
}) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.settings.title}
      description={t.settings.subtitle}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            {t.settings.save}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.settings.displayName} htmlFor="settings-name">
            <input
              id="settings-name"
              value={draft.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t.settings.email} htmlFor="settings-email">
            <input
              id="settings-email"
              type="email"
              value={draft.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label={t.settings.language}
          htmlFor="settings-language"
          hint={t.settings.languageHint}
        >
          <select
            id="settings-language"
            value={draft.language}
            onChange={(e) => set('language', e.target.value as Language)}
            className={inputClass}
          >
            {LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label={t.settings.defaultTaskView} htmlFor="settings-view">
          <select
            id="settings-view"
            value={draft.defaultTaskView}
            onChange={(e) => set('defaultTaskView', e.target.value as AppSettings['defaultTaskView'])}
            className={inputClass}
          >
            <option value="kanban">{t.settings.kanban}</option>
            <option value="list">{t.settings.list}</option>
          </select>
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.settings.notifications}</p>
          <Toggle
            label={t.settings.notifyAiTasks}
            hint={t.settings.notifyAiTasksHint}
            checked={draft.notifyAiTasks}
            onChange={(v) => set('notifyAiTasks', v)}
          />
          <Toggle
            label={t.settings.notifyUpcoming}
            hint={t.settings.notifyUpcomingHint}
            checked={draft.notifyUpcoming}
            onChange={(v) => set('notifyUpcoming', v)}
          />
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.settings.team}</p>
          <button
            type="button"
            onClick={onManageTeam}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Users className="w-4 h-4" />
            {t.settings.manageTeam}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.settings.data}</p>
          <button
            type="button"
            onClick={onResetData}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            {t.settings.resetData}
          </button>
        </div>
      </div>
    </Modal>
  );
};
