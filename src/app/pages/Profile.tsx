import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  loadAuth,
  clearAuth,
  getMe,
  updateMyName,
  saveAuth,
  changePassword,
  deleteMyAccount,
  exportMyData,
} from '../api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useI18n } from '../components/I18nProvider';

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { token, user: cachedUser, source } = loadAuth();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(cachedUser);

  const [nameSaving, setNameSaving] = useState(false);
  const [nameInput, setNameInput] = useState(cachedUser?.name ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await getMe(token);
        if (!cancelled) {
          setMe(data.user);
          setNameInput(data.user.name);
        }
      } catch (err) {
        if (!cancelled) {
          // token 失效或缺失
          clearAuth();
          toast.error(t('sessionExpired'), {
            description: err instanceof Error ? err.message : t('retryLater'),
          });
          navigate('/login?returnTo=' + encodeURIComponent('/profile'), { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const remember = source === 'local';

  const handleLogout = () => {
    clearAuth();
    toast.success(t('logout'));
    navigate('/', { replace: true });
  };

  const handleSaveName = async () => {
    if (!token || !me) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error(t('nameRequired'));
      return;
    }

    setNameSaving(true);
    try {
      const auth = await updateMyName(token, trimmed);
      saveAuth(auth, { remember });
      setMe(auth.user);
      toast.success(t('nameUpdated'));
    } catch (err) {
      toast.error(t('nameUpdateFailed'), {
        description: err instanceof Error ? err.message : t('retryLater'),
      });
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error(t('fillAllFields'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('newPasswordTooShort'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success(t('passwordUpdated'));
    } catch (err) {
      toast.error(t('passwordUpdateFailed'), {
        description: err instanceof Error ? err.message : t('retryLater'),
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token || deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      await deleteMyAccount(token);
      clearAuth();
      toast.success(t('accountDeleted'));
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(t('accountDeleteFailed'), {
        description: err instanceof Error ? err.message : t('retryLater'),
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportData = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportMyData(token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'personal-data.json';
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('個人資料已匯出');
    } catch (err) {
      toast.error('個人資料匯出失敗', {
        description: err instanceof Error ? err.message : t('retryLater'),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <motion.div
          className="overflow-hidden rounded-md border border-border bg-card shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex items-center justify-between border-b border-border p-8">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('profileTitle')}</p>
              <h1 className="text-3xl font-semibold text-foreground">{t('profileTitle')}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{t('profileDesc')}</p>
            </div>

            <Button type="button" variant="outline" onClick={handleLogout}>
              {t('logout')}
            </Button>
          </div>

          <div className="space-y-8 p-8">
            {loading ? (
              <div className="text-muted-foreground">{t('loading')}</div>
            ) : !token ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">{t('profileNotLoggedIn')}</p>
                <Button onClick={() => navigate('/login?returnTo=' + encodeURIComponent('/profile'))}>
                  {t('goToLogin')}
                </Button>
              </div>
            ) : !me ? (
              <div className="text-muted-foreground">{t('profileNotFound')}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-secondary p-5">
                    <div className="text-xs text-muted-foreground">{t('name')}</div>
                    <div className="mt-1 break-words text-lg text-foreground">{me.name}</div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary p-5">
                    <div className="text-xs text-muted-foreground">{t('email')}</div>
                    <div className="mt-1 break-words text-lg text-foreground">{me.email}</div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary p-5 md:col-span-2">
                    <div className="text-xs text-muted-foreground">{t('profileUserId')}</div>
                    <div className="mt-1 break-all font-mono text-sm text-foreground">{me.id}</div>
                  </div>
                </div>

                {/* 編輯姓名 */}
                <div className="border-t border-border pt-6">
                  <h2 className="mb-3 text-lg font-semibold text-foreground">{t('profileEditName')}</h2>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t('profileNameDesc')}
                  </p>
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <label htmlFor="profile-name" className="sr-only">
                      {t('name')}
                    </label>
                    <Input
                      id="profile-name"
                      className="sm:max-w-xs"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={t('profileNamePlaceholder')}
                    />
                    <Button type="button" onClick={handleSaveName} disabled={nameSaving}>
                      {nameSaving ? t('saving') : t('saveChanges')}
                    </Button>
                  </div>
                </div>

                {/* 修改密碼 */}
                <div className="border-t border-border pt-6">
                  <h2 className="mb-3 text-lg font-semibold text-foreground">{t('profileChangePassword')}</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t('profilePasswordDesc')}
                  </p>
                  <div className="max-w-md space-y-3">
                    <div>
                      <label htmlFor="profile-current-password" className="mb-1 block text-xs text-muted-foreground">{t('profileCurrentPassword')}</label>
                      <Input
                        id="profile-current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-new-password" className="mb-1 block text-xs text-muted-foreground">{t('profileNewPassword')}</label>
                      <Input
                        id="profile-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-confirm-new-password" className="mb-1 block text-xs text-muted-foreground">{t('profileConfirmNewPassword')}</label>
                      <Input
                        id="profile-confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                    >
                      {changingPassword ? t('changingPassword') : t('updatePassword')}
                    </Button>
                  </div>
                </div>

                {/* 刪除帳號 */}
                <div className="border-t border-border pt-6">
                  <h2 className="mb-3 text-lg font-semibold text-foreground">匯出個人資料</h2>
                  <p className="mb-3 text-sm text-muted-foreground">
                    下載帳戶、展覽、作品及活動紀錄的 JSON 副本；檔案不包含密碼或分享密鑰。
                  </p>
                  <Button type="button" variant="outline" disabled={exporting} onClick={handleExportData}>
                    {exporting ? '正在準備資料…' : '下載我的資料'}
                  </Button>
                </div>

                <div className="border-t border-border pt-6">
                  <h2 className="mb-3 text-lg font-semibold text-destructive">{t('profileDeleteAccount')}</h2>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t('profileDeleteDesc')}
                  </p>
                  <label htmlFor="profile-delete-confirm" className="mb-2 block text-xs text-muted-foreground">
                    {t('profileDeleteHint')} <span className="font-mono font-semibold">DELETE</span>。
                  </label>
                  <div className="max-w-md space-y-3">
                    <Input
                      id="profile-delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={t('profileDeletePlaceholder')}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteConfirmText !== 'DELETE' || deleting}
                      onClick={handleDeleteAccount}
                    >
                      {deleting ? t('deleting') : t('profileDeleteConfirm')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
