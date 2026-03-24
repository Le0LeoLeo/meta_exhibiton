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
} from '../api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Profile() {
  const navigate = useNavigate();
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
          toast.error('登入已過期，請重新登入', {
            description: err instanceof Error ? err.message : '請稍後再試',
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
    toast.success('已登出');
    navigate('/', { replace: true });
  };

  const handleSaveName = async () => {
    if (!token || !me) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error('姓名不可為空');
      return;
    }

    setNameSaving(true);
    try {
      const auth = await updateMyName(token, trimmed);
      saveAuth(auth, { remember });
      setMe(auth.user);
      toast.success('姓名已更新');
    } catch (err) {
      toast.error('更新姓名失敗', {
        description: err instanceof Error ? err.message : '請稍後再試',
      });
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error('請填寫所有欄位');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('新密碼至少需要 8 個字元');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('兩次新密碼輸入不一致');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('密碼已更新');
    } catch (err) {
      toast.error('修改密碼失敗', {
        description: err instanceof Error ? err.message : '請稍後再試',
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
      toast.success('帳號已刪除');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('刪除帳號失敗', {
        description: err instanceof Error ? err.message : '請稍後再試',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-purple-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="p-8 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-gray-900">使用者中心</h1>
              <p className="text-sm text-gray-600 mt-1">查看與管理您的帳號</p>
            </div>

            <Button type="button" variant="outline" onClick={handleLogout}>
              登出
            </Button>
          </div>

          <div className="p-8 space-y-8">
            {loading ? (
              <div className="text-gray-600">載入中...</div>
            ) : !token ? (
              <div className="space-y-4">
                <p className="text-gray-700">尚未登入，無法查看個人資料。</p>
                <Button onClick={() => navigate('/login?returnTo=' + encodeURIComponent('/profile'))}>
                  前往登入
                </Button>
              </div>
            ) : !me ? (
              <div className="text-gray-700">找不到使用者資料。</div>
            ) : (
              <>
                {/* 基本資訊卡 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-gray-200 p-5">
                    <div className="text-xs text-gray-500">姓名</div>
                    <div className="mt-1 text-lg text-gray-900 break-words">{me.name}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-5">
                    <div className="text-xs text-gray-500">電子郵件</div>
                    <div className="mt-1 text-lg text-gray-900 break-words">{me.email}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-5 md:col-span-2">
                    <div className="text-xs text-gray-500">使用者 ID</div>
                    <div className="mt-1 text-sm font-mono text-gray-900 break-all">{me.id}</div>
                  </div>
                </div>

                {/* 編輯姓名 */}
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">編輯姓名</h2>
                  <p className="text-sm text-gray-600 mb-3">
                    這個名稱會顯示在導覽列和未來的展覽相關功能中。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <Input
                      className="sm:max-w-xs"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="輸入新的姓名"
                    />
                    <Button type="button" onClick={handleSaveName} disabled={nameSaving}>
                      {nameSaving ? '儲存中...' : '儲存變更'}
                    </Button>
                  </div>
                </div>

                {/* 修改密碼 */}
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">修改密碼</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    建議定期更新密碼，並避免與其他服務使用相同密碼。
                  </p>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">目前密碼</div>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">新的密碼</div>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">確認新的密碼</div>
                      <Input
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
                      {changingPassword ? '修改中...' : '更新密碼'}
                    </Button>
                  </div>
                </div>

                {/* 刪除帳號 */}
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-lg font-semibold text-red-600 mb-3">刪除帳號</h2>
                  <p className="text-sm text-gray-700 mb-3">
                    此操作無法復原。所有與此帳號相關的資料將會被永久刪除。
                  </p>
                  <p className="text-xs text-gray-600 mb-2">
                    若要確認刪除，請在下方輸入 <span className="font-mono font-semibold">DELETE</span>。
                  </p>
                  <div className="space-y-3 max-w-md">
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="輸入 DELETE 以確認"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteConfirmText !== 'DELETE' || deleting}
                      onClick={handleDeleteAccount}
                    >
                      {deleting ? '刪除中...' : '永久刪除帳號'}
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
