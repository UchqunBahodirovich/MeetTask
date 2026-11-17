import React, { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field, inputClass } from './ui/Field';
import { User } from '../types';
import { useI18n } from '../i18n';
import { Avatar } from './ui/Avatar';

interface TeamModalProps {
  open: boolean;
  team: User[];
  /** Signed-in user; they cannot remove themselves from here. */
  currentUserId?: string;
  onClose: () => void;
  /** Each action writes to the server right away and resolves once the list is refreshed. */
  onAdd: (member: { name: string; email?: string; role?: string }) => Promise<void>;
  onUpdate: (userId: string, patch: { name?: string; role?: string | null }) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

const ROLE_SUGGESTIONS = [
  'Product Manager',
  'Product Designer',
  'Engineer',
  'Finance Analyst',
  'Sales Lead',
  'Marketing Manager',
  'QA Engineer',
  'Data Analyst',
];

interface DraftMember {
  id: string | null;
  name: string;
  email: string;
  role: string;
}

const emptyDraft: DraftMember = { id: null, name: '', email: '', role: '' };
const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const TeamModal: React.FC<TeamModalProps> = ({ open, team, currentUserId, onClose, onAdd, onUpdate, onRemove }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftMember | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [listError, setListError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Roles already used in this team come first, then the common ones.
  const roleOptions = [...new Set([...team.map((member) => member.role?.trim()).filter((role): role is string => Boolean(role)), ...ROLE_SUGGESTIONS])];

  // Reset only when the dialog opens; the list itself always comes from the server.
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setFormError('');
    setListError('');
    setSavedId(null);
  }, [open]);

  useEffect(() => {
    if (!savedId) return;
    const timer = window.setTimeout(() => setSavedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [savedId]);

  const commitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || busy) return;
    const name = draft.name.trim();
    if (name.length < 2) {
      setFormError(t.team.nameRequired);
      return;
    }
    const email = draft.email.trim();
    const role = draft.role.trim();
    setBusy(true);
    setFormError('');
    try {
      if (draft.id) {
        const existing = team.find((member) => member.id === draft.id);
        const patch: { name?: string; role?: string | null } = {};
        if (existing?.name !== name) patch.name = name;
        if ((existing?.role ?? '') !== role) patch.role = role || null;
        if (Object.keys(patch).length > 0) await onUpdate(draft.id, patch);
        setSavedId(draft.id);
      } else {
        await onAdd({ name, email: email || undefined, role: role || undefined });
      }
      setDraft(null);
    } catch (err) {
      setFormError(message(err, t.team.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: User) => {
    setPendingDelete(null);
    setRemovingId(member.id);
    setListError('');
    try {
      await onRemove(member.id);
      if (draft?.id === member.id) setDraft(null);
    } catch (err) {
      setListError(message(err, t.team.removeFailed));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t.team.title}
        description={t.team.subtitle}
        size="lg"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            {t.common.close}
          </button>
        }
      >
        <div className="space-y-4">
          {listError && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{listError}</p>
          )}
          <div className="space-y-2">
            {team.map((member) => {
              const isSelf = member.id === currentUserId;
              const removing = removingId === member.id;
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 group hover:border-slate-300 transition-colors ${removing ? 'opacity-50' : ''}`}
                >
                  <Avatar name={member.name} src={member.avatar} className="w-9 h-9" textClassName="text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {member.name}
                      {isSelf && <span className="ml-1.5 text-xs font-medium text-slate-500">({t.team.you})</span>}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.role || <span className="italic text-slate-500">{t.team.noRole}</span>}
                      {member.email ? ` · ${member.email}` : ''}
                    </p>
                  </div>
                  {savedId === member.id && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600" role="status"><Check className="w-3.5 h-3.5" />{t.team.saved}</span>
                  )}
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => {
                      setFormError('');
                      setDraft({ id: member.id, name: member.name, email: member.email ?? '', role: member.role ?? '' });
                    }}
                    aria-label={t.team.editLabel(member.name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!isSelf && (
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => setPendingDelete(member)}
                      aria-label={removing ? t.team.removing : t.team.removeLabel(member.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}

            {team.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                {t.team.empty}
              </p>
            )}
          </div>

          {draft ? (
            <form onSubmit={(e) => void commitDraft(e)} className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{draft.id ? t.team.editMember : t.team.newMember}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setFormError('');
                  }}
                  aria-label={t.team.cancelForm}
                  className="p-1 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t.team.name} htmlFor="member-name">
                  <input
                    id="member-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder={t.team.namePlaceholder}
                    maxLength={80}
                    className={inputClass}
                  />
                </Field>
                <Field label={t.team.email} htmlFor="member-email">
                  <input
                    id="member-email"
                    type="email"
                    value={draft.email}
                    // An existing member's email is their login; it is not edited here.
                    disabled={Boolean(draft.id)}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    placeholder={t.team.emailPlaceholder}
                    className={`${inputClass} disabled:opacity-60`}
                  />
                </Field>
              </div>

              <Field label={t.team.role} htmlFor="member-role" hint={t.team.roleHint}>
                <input
                  id="member-role"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder={t.team.rolePlaceholder}
                  maxLength={60}
                  className={inputClass}
                />
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t.team.roleSuggestions}>
                  {roleOptions.map((role) => (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={draft.role.trim() === role}
                      onClick={() => setDraft({ ...draft, role })}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${draft.role.trim() === role ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </Field>

              {formError && (
                <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {busy ? t.team.saving : draft.id ? t.team.updateMember : t.team.addMemberButton}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setDraft(emptyDraft);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {t.team.addMember}
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.team.removeTitle}
        message={t.team.removeMessage(pendingDelete?.name ?? '')}
        confirmLabel={t.common.remove}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void removeMember(pendingDelete)}
      />
    </>
  );
};
