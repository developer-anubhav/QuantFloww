import React from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store';
import { logout } from './store/slices/authSlice';
import { Dashboard } from './pages/Dashboard';
import { StockDetails } from './pages/StockDetails';
import { Watchlists } from './pages/Watchlists';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DarkModeToggle } from './components/DarkModeToggle';
import { LayoutDashboard, Star, User, LogOut } from 'lucide-react';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { username, isAuthenticated } = useSelector((state: RootState) => state.auth);


  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-all duration-300">
      
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/75 dark:bg-[#09090b]/75 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-zinc-950 dark:text-zinc-50 font-black tracking-tighter text-lg">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm">
                Q
              </div>
              QuantFloww
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-all"
              >
                <LayoutDashboard className="w-4 h-4 text-blue-500" />
                Console
              </Link>
              <Link
                to="/watchlists"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-all"
              >
                <Star className="w-4 h-4 text-amber-500" />
                Watchlists
              </Link>
            </nav>
          </div>

          {/* User Section / Theme Toggle */}
          <div className="flex items-center gap-4">
            <DarkModeToggle />

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800"></div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  <User className="w-4 h-4 text-zinc-400" />
                  {username}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-zinc-400 hover:text-rose-500 text-xs font-semibold p-1.5 rounded-lg hover:bg-rose-500/5 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 px-2 py-1"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Pages Content Canvas */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks/:symbol" element={<StockDetails />} />
          <Route
            path="/watchlists"
            element={
              <ProtectedRoute>
                <Watchlists />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Console Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] py-6">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} QuantFloww FinTech. All rights reserved.
          </div>
          <div className="flex gap-4">
            <Link to="/" className="hover:underline">Dashboard</Link>
            <Link to="/watchlists" className="hover:underline">Watchlists</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
