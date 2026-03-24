import { Button } from './ui/button';
import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Menu, X, LogOut, User } from 'lucide-react';
import { clearAuth, loadAuth } from '../api/client';
import { toast } from 'sonner';

export function Navigation() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const { token, user } = loadAuth();

  const handleLogout = () => {
    clearAuth();
    toast.success('已登出');
    // 簡單做法：強制刷新讓 UI 同步登入狀態
    window.location.href = '/';
  };

  const navItems = [
    { label: '首頁', path: '/' },
    { label: '虛擬展廳', path: '/virtual-gallery' },
    { label: '展覽活動', path: '/exhibitions' },
    { label: '解決方案', path: '/solutions' },
    { label: '資源中心', path: '/resources' },
    { label: '幫助支援', path: '/support' },
  ];

  return (
    <motion.nav 
      className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/" className="text-2xl text-cyan-500">
              <motion.span
                animate={{ 
                  textShadow: [
                    "0 0 0px rgba(6, 182, 212, 0)",
                    "0 0 10px rgba(6, 182, 212, 0.5)",
                    "0 0 0px rgba(6, 182, 212, 0)"
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                MetaExpo
              </motion.span>
            </Link>
          </motion.div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={index}
                  to={item.path} 
                  className={`relative text-sm py-1 transition-colors ${
                    isActive ? 'text-purple-600' : 'text-gray-700 hover:text-gray-900'
                  }`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {item.label}
                  {(hoveredIndex === index || isActive) && (
                    <motion.div
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-purple-600"
                      layoutId="navbar-indicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Auth Buttons + Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-3">
              {token ? (
                <>
                  <Link to="/profile" className="flex items-center text-sm text-gray-700 gap-2 px-2 hover:text-gray-900">
                    <User className="size-4 text-gray-500" />
                    <span className="max-w-40 truncate">{user?.name ?? user?.email ?? '已登入'}</span>
                  </Link>
                  <Link to="/profile">
                    <Button variant="ghost" className="text-sm">
                      個人資料
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4 mr-2" />
                    登出
                  </Button>
                </>
              ) : (
                <>
              <Link to="/register">
                <Button variant="ghost" className="text-sm">
                  註冊帳號
                </Button>
              </Link>
              <Link to="/login">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white text-sm">
                  立即體驗
                </Button>
              </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <motion.button
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden bg-white border-t border-gray-100"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item, index) => {
                const isActive = location.pathname === item.path;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={item.path}
                      className={`block px-4 py-3 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                {token ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700">
                      <User className="size-4 text-gray-500" />
                      <span className="truncate">{user?.name ?? user?.email ?? '已登入'}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-sm"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogOut className="size-4 mr-2" />
                      登出
                    </Button>
                  </>
                ) : (
                  <>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full text-sm">
                    註冊帳號
                  </Button>
                </Link>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm">
                    立即體驗
                  </Button>
                </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}