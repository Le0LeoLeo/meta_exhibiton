import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { loadAuth, getMyHostedCompetitions, getAdminCompetitionEntries, reviewCompetitionEntry, updateCompetition, type Competition, type CompetitionEntry } from '../api/client';
import { toast } from 'sonner';
import { Shield, Loader2, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../components/I18nProvider';

const STATUS_LABELS: Record<Competition['status'], string> = {
  draft: 'caStatusDraft',
  open: 'caStatusOpen',
  closed: 'caStatusClosed',
  judging: 'caStatusJudging',
  completed: 'caStatusCompleted',
};

export default function CompetitionAdmin() {
  const { t } = useI18n();
  const [adminSecret] = useState('');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFields, setDraftFields] = useState<Array<{ id: string; label: string; placeholder: string; type: 'text' | 'textarea' | 'file'; accept: string; multiple: boolean; required: boolean }>>([]);
  const [savingFields, setSavingFields] = useState(false);

  const selectedCompetition = useMemo(
    () => competitions.find((competition) => competition.id === selectedCompetitionId) ?? null,
    [competitions, selectedCompetitionId],
  );

  useEffect(() => {
    setDraftFields(selectedCompetition?.submissionFields?.length
      ? selectedCompetition.submissionFields.map((field) => ({
          id: field.id,
          label: field.label,
          placeholder: field.placeholder || '',
          type: field.type,
          accept: field.accept || '',
          multiple: Boolean(field.multiple),
          required: field.required,
        }))
      : []);
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    const { token } = loadAuth();
    if (!token) {
      toast.error(t('caLoginFirst'));
      return;
    }

    setLoading(true);
    try {
      const result = await getMyHostedCompetitions(token);
      setCompetitions(result.competitions);
      if (!selectedCompetitionId && result.competitions[0]) {
        setSelectedCompetitionId(result.competitions[0].id);
      }
    } catch (err) {
      toast.error(t('caLoadFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async (competitionId: string) => {
    const { token } = loadAuth();
    if (!token) {
      toast.error(t('caLoginFirst'));
      return;
    }

    try {
      const result = await getAdminCompetitionEntries(token, competitionId, adminSecret);
      setEntries(result.entries);
    } catch (err) {
      toast.error(t('caLoadEntriesFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    }
  };

  useEffect(() => {
    void loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetitionId) {
      void loadEntries(selectedCompetitionId);
    }
  }, [selectedCompetitionId]);

  const handleUpdateStatus = async (competition: Competition, status: Competition['status']) => {
    const { token } = loadAuth();
    if (!token) return;
    try {
      const result = await updateCompetition(token, competition.id, { status });
      setCompetitions((prev) => prev.map((item) => item.id === competition.id ? result.competition : item));
      toast.success(t('caStatusUpdated'));
    } catch (err) {
      toast.error(t('caStatusUpdateFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    }
  };

  const handleTogglePublish = async (competition: Competition) => {
    const { token } = loadAuth();
    if (!token) return;
    try {
      const result = await updateCompetition(token, competition.id, { isPublic: !competition.isPublic });
      setCompetitions((prev) => prev.map((item) => item.id === competition.id ? result.competition : item));
      if (selectedCompetitionId === competition.id) {
        setSelectedCompetitionId(result.competition.id);
      }
      toast.success(competition.isPublic ? t('caPublishedHidden') : t('caPublishedVisible'));
    } catch (err) {
      toast.error(t('caPublishUpdateFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    }
  };

  const handleUpdateFields = async () => {
    if (!selectedCompetition) return;
    const { token } = loadAuth();
    if (!token) return;
    const cleanedFields = draftFields
      .filter((field) => field.label.trim())
      .map((field, index) => ({
        id: field.id.trim() || `field_${index + 1}`,
        label: field.label.trim(),
        placeholder: field.placeholder.trim(),
        type: field.type,
        accept: field.type === 'file' ? field.accept.trim() : undefined,
        multiple: field.type === 'file' ? field.multiple : undefined,
        required: field.required,
      }));

    setSavingFields(true);
    try {
      const result = await updateCompetition(token, selectedCompetition.id, { submissionFields: cleanedFields });
      setCompetitions((prev) => prev.map((item) => item.id === selectedCompetition.id ? result.competition : item));
      setSelectedCompetitionId(result.competition.id);
      toast.success(t('caFieldsUpdated'));
    } catch (err) {
      toast.error(t('caFieldsUpdateFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    } finally {
      setSavingFields(false);
    }
  };

  const addField = () => {
    setDraftFields((prev) => [...prev, { id: `field_${prev.length + 1}`, label: '', placeholder: '', type: 'text', accept: '', multiple: false, required: false }]);
  };

  const removeField = (id: string) => {
    setDraftFields((prev) => prev.filter((field) => field.id !== id));
  };

  const handleReviewEntry = async (entryId: string, payload: { status?: CompetitionEntry['status']; rank?: number | null }) => {
    const { token } = loadAuth();
    if (!token) return;
    try {
      const result = await reviewCompetitionEntry(token, entryId, payload);
      setEntries((prev) => prev.map((entry) => entry.id === entryId ? result.entry : entry));
      toast.success(t('caEntryUpdated'));
    } catch (err) {
      toast.error(t('caEntryUpdateFailed'), { description: err instanceof Error ? err.message : t('caUnknownError') });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"><Shield className="size-3.5" /> {t('caBadge')}</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{t('caTitle')}</h1>
              <p className="mt-2 text-slate-600">{t('caDesc')}</p>
            </div>
          </div>

          <div className="mt-6 max-w-md">
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {t('caNote')}
            </p>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> {t('caLoading')}</div> : null}

        <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="px-3 py-2 text-lg font-medium text-slate-900">{t('caMyCompetitions')}</h2>
            <div className="space-y-2">
              {competitions.map((competition) => (
                <button
                  key={competition.id}
                  type="button"
                  onClick={() => setSelectedCompetitionId(competition.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedCompetitionId === competition.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="font-medium text-slate-900">{competition.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{t(STATUS_LABELS[competition.status])} · {competition.isPublic ? t('caPublic') : t('caPrivate')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('caHomeGallery')}{competition.hostGallery?.title || t('caNoName')}</p>
                </button>
              ))}
              {competitions.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">{t('caNoCompetitions')}</p> : null}
            </div>
          </div>

          <div className="space-y-6">
            {selectedCompetition ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-semibold text-slate-950">{selectedCompetition.title}</h2>
                    <p className="mt-2 text-slate-600">{selectedCompetition.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['draft', 'open', 'closed', 'judging', 'completed'] as Competition['status'][]).map((status) => (
                      <Button key={status} variant={selectedCompetition.status === status ? 'default' : 'outline'} onClick={() => void handleUpdateStatus(selectedCompetition, status)}>
                        {t(STATUS_LABELS[status])}
                      </Button>
                    ))}
                    <Button variant="outline" onClick={() => void handleTogglePublish(selectedCompetition)}>
                      {selectedCompetition.isPublic ? t('caUnpublish') : t('caPublish')}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  <p>{t('caHostGallery')}{selectedCompetition.hostGallery?.title || selectedCompetition.hostGalleryId}</p>
                  <p>{t('caPublishStatus')}{selectedCompetition.isPublic ? t('caPublicVisible') : t('caPublishedHidden')}</p>
                  <p>{t('caRegDeadline')}{new Date(selectedCompetition.registrationDeadline).toLocaleString('zh-TW')}</p>
                  <p>{t('caVoteDeadline')}{selectedCompetition.votingDeadline ? new Date(selectedCompetition.votingDeadline).toLocaleString('zh-TW') : t('caNotSet')}</p>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{t('caFieldSettings')}</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={addField}><Plus className="mr-2 size-4" /> {t('caAddField')}</Button>
                      <Button onClick={() => void handleUpdateFields()} disabled={savingFields}>{savingFields ? t('caSaving') : t('caSaveFields')}</Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
                    <div className="space-y-3">
                      {draftFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 grid gap-3 md:grid-cols-[1fr,1fr,140px,100px,auto]">
                              <Input value={field.label} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, label: e.target.value } : item))} placeholder={t('caLabelPlaceholder')} />
                              <select value={field.type} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, type: e.target.value as 'text' | 'textarea' | 'file' } : item))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
                                <option value="text">{t('caTypeText')}</option>
                                <option value="textarea">{t('caTypeTextarea')}</option>
                                <option value="file">{t('caTypeFile')}</option>
                              </select>
                              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={field.required} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, required: e.target.checked } : item))} /> {t('caRequired')}</label>
                              <Button variant="outline" onClick={() => removeField(field.id)}><Trash2 className="size-4" /></Button>
                              <div className="md:col-span-5 space-y-3"><Input value={field.placeholder} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, placeholder: e.target.value } : item))} placeholder={t('caPlaceholderLabel')} />{field.type === 'file' ? <div className="grid gap-2 md:grid-cols-2"><Input value={field.accept} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, accept: e.target.value } : item))} placeholder={t('caAcceptPlaceholder')} /><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={field.multiple} onChange={(e) => setDraftFields((prev) => prev.map((item, idx) => idx === index ? { ...item, multiple: e.target.checked } : item))} /> {t('caMultiSelect')}</label></div> : null}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <h4 className="text-sm font-semibold text-slate-900">{t('caFormPreview')}</h4>
                      <div className="mt-4 space-y-3">
                        {draftFields.map((field) => field.id === 'galleryId' ? null : (
                          <div key={field.id} className="space-y-1.5">
                            <div className="text-sm font-medium text-slate-700">{field.label} {field.required ? '*' : ''}</div>
                            {field.type === 'textarea' ? <div className="min-h-[84px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">{field.placeholder || field.label}</div> : field.type === 'file' ? <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">{t('caTypeFile')}</div> : <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">{field.placeholder || field.label}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-2xl font-semibold text-slate-950">{t('caEntries')}</h3>
              <div className="mt-4 space-y-4">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium text-slate-900">{entry.gallery?.title || t('caNoName')}</p>
                        <p className="mt-1 text-sm text-slate-500">{t('caEntryOwner')}{entry.ownerName || t('caAnonymous')} · {t('caVotes')}{entry.voteCount}</p>
                        {entry.statement ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{entry.statement}</p> : null}
                        <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('caSubmissionContent')}</p>
                          {entry.submission && Object.keys(entry.submission).length > 0 ? (
                            <div className="space-y-2 text-sm text-slate-700">
                              {Object.entries(entry.submission).map(([key, value]) => (
                                <div key={key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <p className="text-xs font-medium text-slate-500">{key}</p>
                                  <p className="mt-1 whitespace-pre-wrap">{Array.isArray(value) ? value.join(', ') : String(value ?? '')}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">{t('caNoSubmission')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void handleReviewEntry(entry.id, { status: 'approved' })}>{t('caApprove')}</Button>
                        <Button size="sm" variant="outline" onClick={() => void handleReviewEntry(entry.id, { status: 'rejected' })}>{t('caReject')}</Button>
                        <Button size="sm" onClick={() => {
                          const raw = window.prompt(t('caSetRank'), entry.rank ? String(entry.rank) : '');
                          if (raw === null) return;
                          const rank = raw.trim() ? Number(raw) : null;
                          void handleReviewEntry(entry.id, { rank: Number.isFinite(rank as number) ? rank : null });
                        }}>{t('caSetRank')}</Button>
                      </div>
                    </div>
                  </div>
                ))}
                {entries.length === 0 ? <p className="text-sm text-slate-500">{t('caNoEntries')}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
