import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { createCompetitionEntry, deleteCompetitionEntry, getCompetitionById, loadAuth, voteCompetitionEntry, type Competition, type CompetitionEntry } from '../api/client';
import { toast } from 'sonner';
import { useI18n } from '../components/I18nProvider';
import { Trophy, Vote, Loader2, Medal, CalendarClock, Paperclip, Pencil } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

type SubmissionField = NonNullable<Competition['submissionFields']>[number];
type SubmissionState = Record<string, string | string[]>;

function makeInitialSubmission(fields: SubmissionField[]) {
  return fields.reduce<SubmissionState>((acc, field) => {
    acc[field.id] = field.type === 'file' ? '[]' : '';
    return acc;
  }, {});
}

export default function CompetitionDetail() {
  const { t } = useI18n();
  const { competitionId = '' } = useParams();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteOpen, setVoteOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<CompetitionEntry | null>(null);
  const [voterName, setVoterName] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinSubmission, setJoinSubmission] = useState<SubmissionState>({});
  const [joining, setJoining] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const { user: currentUser } = loadAuth();
  const submissionFields = useMemo<SubmissionField[]>(() => competition?.submissionFields ?? [], [competition]);

  const statusLabel = (status: Competition['status']) => {
    if (status === 'draft') return t('cdStatusDraft');
    if (status === 'open') return t('cdStatusOpen');
    if (status === 'closed') return t('cdStatusClosed');
    if (status === 'judging') return t('cdStatusJudging');
    return t('cdStatusCompleted');
  };

  useEffect(() => {
    setJoinSubmission(makeInitialSubmission(submissionFields));
  }, [submissionFields]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const result = await getCompetitionById(competitionId);
        setCompetition(result.competition);
        setEntries(result.entries);
      } catch (err) {
        toast.error(t('cdToastLoadFailed'), { description: err instanceof Error ? err.message : t('cdToastUnknownError') });
      } finally {
        setLoading(false);
      }
    };

    if (competitionId) void run();
  }, [competitionId]);

  const rankedEntries = useMemo(
    () => [...entries].sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return b.voteCount - a.voteCount;
    }),
    [entries],
  );

  const handleVote = async () => {
    if (!competition || !activeEntry) return;
    setSubmittingVote(true);
    try {
      const result = await voteCompetitionEntry(competition.id, activeEntry.id, { voterName, voterEmail });
      setEntries((prev) => prev.map((entry) => (entry.id === activeEntry.id ? result.entry : entry)));
      setVoteOpen(false);
      setVoterName('');
      setVoterEmail('');
      setActiveEntry(null);
      toast.success(t('cdToastVoteSuccess'));
    } catch (err) {
      toast.error(t('cdToastVoteFailed'), { description: err instanceof Error ? err.message : t('cdToastUnknownError') });
    } finally {
      setSubmittingVote(false);
    }
  };

  const isEditing = Boolean(editingEntryId);

  const handleJoinCompetition = async () => {
    if (!competition) return;
    const { token } = loadAuth();
    if (!token) {
      toast.error(t('cdToastLoginRequired'));
      return;
    }

    if (submissionFields.length === 0) {
      toast.error(t('cdToastNoFields'));
      return;
    }

    const submission = Object.fromEntries(
      submissionFields.map((field) => {
        if (field.type === 'file') {
          const files = Array.from((joinSubmission[field.id] as string[] | undefined) || []);
          return [field.id, files.join(', ')];
        }
        return [field.id, String(joinSubmission[field.id] ?? '').trim()];
      }),
    );

    setJoining(true);
    try {
      const result = await createCompetitionEntry(token, {
        competitionId: competition.id,
        submission,
      });
      setEntries((prev) => [result.entry, ...prev.filter((entry) => entry.id !== result.entry.id)]);
      setJoinOpen(false);
      setEditingEntryId(null);
      setJoinSubmission(makeInitialSubmission(submissionFields));
      toast.success(isEditing ? t('cdToastJoinUpdated') : t('cdToastJoinSuccess'));
    } catch (err) {
      console.error('competition entry submit failed', err);
      toast.error(t('cdToastJoinFailed'), { description: err instanceof Error ? err.message : t('cdToastUnknownError') });
    } finally {
      setJoining(false);
    }
  };

  const openEditEntry = (entry: CompetitionEntry) => {
    const nextSubmission = makeInitialSubmission(submissionFields);
    if (entry.submission) {
      for (const [key, value] of Object.entries(entry.submission)) {
        nextSubmission[key] = Array.isArray(value) ? value : String(value ?? '');
      }
    } else {
      nextSubmission.statement = entry.statement;
    }
    setJoinSubmission(nextSubmission);
    setEditingEntryId(entry.id);
    setJoinOpen(true);
  };

  const handleDeleteEntry = async (entry: CompetitionEntry) => {
    if (!competition) return;
    const { token } = loadAuth();
    if (!token) {
      toast.error(t('cdToastDeleteLoginRequired'));
      return;
    }

    if (!window.confirm(t('cdDeleteConfirm'))) return;

    setDeletingEntryId(entry.id);
    try {
      await deleteCompetitionEntry(token, competition.id, entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      if (activeEntry?.id === entry.id) {
        setActiveEntry(null);
        setVoteOpen(false);
      }
      if (editingEntryId === entry.id) {
        setEditingEntryId(null);
        setJoinOpen(false);
        setJoinSubmission(makeInitialSubmission(submissionFields));
      }
      toast.success(t('cdToastDeleteSuccess'));
    } catch (err) {
      toast.error(t('cdToastDeleteFailed'), { description: err instanceof Error ? err.message : t('cdToastUnknownError') });
    } finally {
      setDeletingEntryId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-10 text-slate-500"><Loader2 className="size-4 animate-spin" /> {t('cdLoading')}</div>;
  }

  if (!competition) {
    return <div className="p-10 text-slate-500">{t('cdNotFound')}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="grid lg:grid-cols-[1.2fr,1fr]">
            <div className="h-72 bg-slate-100 lg:h-full">
              <ImageWithFallback
                src={competition.coverImage || 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&q=80'}
                alt={competition.title}
                className="h-full w-full object-cover"
              />
            </div>
            <CardContent className="p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                <Trophy className="size-3.5" /> {statusLabel(competition.status)}
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{competition.title}</h1>
              <p className="mt-4 leading-7 text-slate-600">{competition.description}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="flex items-center gap-2 font-medium text-slate-900"><CalendarClock className="size-4" /> {t('cdRegDeadline')}</p>
                  <p className="mt-2">{new Date(competition.registrationDeadline).toLocaleString('zh-TW')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="flex items-center gap-2 font-medium text-slate-900"><Vote className="size-4" /> {t('cdVoteDeadline')}</p>
                  <p className="mt-2">{competition.votingDeadline ? new Date(competition.votingDeadline).toLocaleString('zh-TW') : t('cdNotSet')}</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                <h2 className="text-lg font-medium text-slate-900">{t('cdRulesTitle')}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{competition.rules}</p>
              </div>
            </CardContent>
          </div>
        </Card>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">{t('cdEntriesTitle')}</h2>
            <p className="mt-2 text-slate-600">{t('cdEntriesDesc')}</p>
          </div>
          <Button onClick={() => setJoinOpen(true)}>{t('cdJoinBtn')}</Button>
        </div>

        <div className="space-y-4">
          {entries.length === 0 ? <p className="text-sm text-slate-500">{t('cdNoEntries')}</p> : null}
          {rankedEntries.map((entry, index) => (
            <Card key={entry.id} className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-slate-950">{t('cdEntryPrefix')}{index + 1}</CardTitle>
                    <CardDescription className="mt-2 text-sm text-slate-500">{t('cdEntryOwner')}{entry.ownerName || t('cdAnonymous')} · {t('cdEntryStatus')}{entry.status === 'pending' ? t('cdStatusPending') : entry.status === 'approved' ? t('cdStatusApproved') : entry.status === 'rejected' ? t('cdStatusRejected') : entry.status}</CardDescription>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-700">
                    <p className="text-xs">{t('cdRank')}</p>
                    <p className="text-lg font-semibold">{entry.rank ?? index + 1}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{entry.statement}</p>
                {entry.assets.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {entry.assets.map((asset) => (
                      <a key={asset.url} href={asset.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-violet-700 hover:underline">
                        <Paperclip className="size-4" />{asset.name}
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2 text-slate-700"><Medal className="size-4 text-amber-500" /> {t('cdVotes')} {entry.voteCount}</div>
                  <div className="flex items-center gap-2">
                    {currentUser?.id === entry.galleryOwnerId ? (
                      <>
                        <Button variant="outline" onClick={() => openEditEntry(entry)}>
                          <Pencil className="mr-2 size-4" /> {t('cdEditEntry')}
                        </Button>
                        <Button variant="outline" onClick={() => void handleDeleteEntry(entry)} disabled={deletingEntryId === entry.id}>
                          {deletingEntryId === entry.id ? t('cdDeleting') : t('cdDeleteEntry')}
                        </Button>
                      </>
                    ) : null}
                    <Button onClick={() => { setActiveEntry(entry); setVoteOpen(true); }} disabled={entry.status !== 'approved'}>
                      <Vote className="mr-2 size-4" /> {t('cdVoteBtn')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={joinOpen} onOpenChange={(open) => { setJoinOpen(open); if (!open) setEditingEntryId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? t('cdDialogEditTitle') : t('cdDialogJoinTitle')}</DialogTitle>
            <DialogDescription>{isEditing ? t('cdDialogEditDesc') : t('cdDialogJoinDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {submissionFields.length === 0 ? <p className="text-sm text-slate-500">{t('cdDialogNoFields')}</p> : null}
            {isEditing ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('cdDialogEditNotice')}</p> : null}
            {submissionFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'file' ? (
                  <Input
                    type="file"
                    multiple={field.multiple}
                    accept={field.accept || undefined}
                    onChange={(e) => setJoinSubmission((prev) => ({
                      ...prev,
                      [field.id]: Array.from(e.target.files || []).map((file) => file.name),
                    }))}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={String(joinSubmission[field.id] ?? '')}
                    onChange={(e) => setJoinSubmission((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    placeholder={field.placeholder || field.label}
                  />
                ) : (
                  <Input
                    value={String(joinSubmission[field.id] ?? '')}
                    onChange={(e) => setJoinSubmission((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={field.placeholder || field.label}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={joining}>{t('cdDialogCancel')}</Button>
            <Button onClick={() => void handleJoinCompetition()} disabled={joining}>{joining ? t('cdDialogSending') : isEditing ? t('cdDialogSaveEdit') : t('cdDialogSubmit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voteOpen} onOpenChange={setVoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cdVoteDialogTitle')}</DialogTitle>
            <DialogDescription>{t('cdVoteDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={voterName} onChange={(e) => setVoterName(e.target.value)} placeholder={t('cdVoteNamePlaceholder')} />
            <Input value={voterEmail} onChange={(e) => setVoterEmail(e.target.value)} placeholder={t('cdVoteEmailPlaceholder')} type="email" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoteOpen(false)} disabled={submittingVote}>{t('cdDialogCancel')}</Button>
            <Button onClick={() => void handleVote()} disabled={submittingVote}>{submittingVote ? t('cdDialogSending') : t('cdVoteConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
