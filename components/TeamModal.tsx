import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field, inputClass } from './ui/Field';
import { User } from '../types';
import { useI18n } from '../i18n';

interface TeamModalProps {
  open: boolean;
  team: User[];
  onClose: () => void;
  onSave: (team: User[]) => void;
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

const AVATAR_COLORS = ['2563eb', '10b981', 'f59e0b', '8b5cf6', 'ef4444', '0ea5e9'];

const avatarFor = (name: string, index: number) =>
  `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name || 'member')}&backgroundColor=${
    AVATAR_COLORS[index % AVATAR_COLORS.length]
  }`;

interface DraftMember {
  id: string | null;
  name: string;
  email: string;
  role: string;
}

const emptyDraft: DraftMember = { id: null, name: '', email: '', role: '' };

export const TeamModal: React.FC<TeamModalProps> = ({ open, team, onClose, onSave }) => {
  const [members, setMembers] = useState<User[]>(team);
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftMember | null>(null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);

  useEffect(() => {
    if (open) {
      setMembers(team);
      setDraft(null);
      setError('');
    }
  }, [open, team]);

  const commitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t.team.nameRequired);
      return;
    }
    const email = draft.email.trim();
    const role = draft.role.trim();

    setMembers((prev) => {
      if (draft.id) {
        return prev.map((member) =>
          member.id === draft.id ? { ...member, name, email, role: role || undefined } : member,
        );
      }
      const id = `member-${Date.now()}`;
      return [
        ...prev,
        { id, name, email, role: role || undefined, avatar: avatarFor(name, prev.length) },
      ];
    });
    setDraft(null);
    setError('');
  };

  const removeMember = (member: User) => {
    setMembers((prev) => prev.filter((item) => item.id !== member.id));
    setPendingDelete(null);
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
                onSave(members);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              {t.team.saveTeam}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 group hover:border-slate-300 transition-colors"
              >
                <img
                  src={member.avatar || avatarFor(member.name, 0)}
                  alt=""
                  className="w-9 h-9 rounded-full bg-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {member.role || <span className="italic text-slate-400">{t.team.noRole}</span>}
                    {member.email ? ` · ${member.email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: member.id,
                      name: member.name,
                      email: member.email ?? '',
                      role: member.role ?? '',
                    })
                  }
                  aria-label={t.team.editLabel(member.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(member)}
                  aria-label={t.team.removeLabel(member.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {members.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                {t.team.empty}
              </p>
            )}
          </div>

          {draft ? (
            <form onSubmit={commitDraft} className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{draft.id ? t.team.editMember : t.team.newMember}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setError('');
                  }}
                  aria-label={t.team.cancelForm}
                  className="p-1 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t.team.name} htmlFor="member-name" error={error}>
                  <input
                    id="member-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder={t.team.namePlaceholder}
                    className={inputClass}
                  />
                </Field>
                <Field label={t.team.email} htmlFor="member-email">
                  <input
                    id="member-email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    placeholder={t.team.emailPlaceholder}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field
                label={t.team.role}
                htmlFor="member-role"
                hint={t.team.roleHint}
              >
                <input
                  id="member-role"
                  list="role-suggestions"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder={t.team.rolePlaceholder}
                  className={inputClass}
                />
                <datalist id="role-suggestions">
                  {ROLE_SUGGESTIONS.map((role) => (
                    <option key={role} value={role} />
                  ))}
                </datalist>
              </Field>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {draft.id ? t.team.updateMember : t.team.addMemberButton}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setDraft(emptyDraft)}
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
        onConfirm={() => pendingDelete && removeMember(pendingDelete)}
      />
    </>
  );
};
