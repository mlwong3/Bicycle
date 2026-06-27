import { motion } from 'motion/react';
import { X, Map, AlertTriangle, Cpu, User, Share2, HelpCircle, Trophy } from 'lucide-react';

interface MenuSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  userScore: number;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

export default function MenuSidebar({ isOpen, onClose, activeTab, onSelectTab, userScore, onNotify }: MenuSidebarProps) {
  if (!isOpen) return null;

  const menuItems = [
    { id: 'map', name: '地圖導航', icon: Map },
    { id: 'report', name: '違規舉報', icon: AlertTriangle },
    { id: 'nfc', name: 'NFC 登記', icon: Cpu },
    { id: 'personal', name: '個人中心', icon: User },
  ];

  return (
    <div id="side-drawer" className="fixed inset-0 z-50 flex">
      {/* Black backdrop overlay */}
      <motion.div
        id="drawer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black cursor-pointer"
      />

      {/* Drawer canvas */}
      <motion.div
        id="drawer-canvas"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative flex flex-col w-72 max-w-xs h-full bg-white shadow-2xl z-10 p-5 font-sans"
      >
        <div className="flex justify-between items-center pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="text-[#006b2c] font-black tracking-tight text-lg">單車管理</span>
            <span className="text-[10px] bg-[#006b2c]/10 text-[#006b2c] px-2 py-0.5 rounded-full font-bold">PRO</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User preview inside menu */}
        <div className="py-4 flex items-center gap-3">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2GAAAL_i2PXfsqLZhfn3lsWWF6-uK4QKsdNZXuI2kUvCtks39JCewGLAw-svhbdzIe6QpU5g26GcIg6BlkuPVCAIjF9CFcNYq4jYlsF6_0kYZPIVbMgIX0L0wael4Geq8nx2m_2HWe_i7AVVaKgeoFTjQqthcvbs2Pr5PDFoT61mDc_0-evvpZgpKSOEzomorvS7N9CnG0bloy9FSOh7SY8VOwsHMo_DlTXJx1XW-dHU2qH0VyZXiKXy3Nm0tq_xE1LL57K3grA8A"
            alt="User profile thumbnail"
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover border border-[#006b2c]"
          />
          <div>
            <p className="text-xs font-bold text-zinc-900 leading-tight">單車愛好者</p>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5 flex items-center gap-0.5">
              <Trophy className="w-3.5 h-3.5 text-[#006b2c] fill-current" />
              綠色積分: {userScore}
            </p>
          </div>
        </div>

        {/* Links lists navigation selection */}
        <nav className="flex-1 space-y-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`drawer-link-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 text-xs font-bold rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#006b2c] text-white shadow-md shadow-[#006b2c]/10'
                    : 'text-zinc-600 hover:bg-[#006b2c]/5 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info inside menu */}
        <div className="pt-4 border-t border-zinc-100 flex flex-col gap-2.5 text-[10px] text-zinc-400 font-bold">
          <button onClick={() => {
            navigator.clipboard.writeText(window.location.href)
              .then(() => onNotify('應用程式連結已複製。', 'success'))
              .catch(() => onNotify('未能複製連結，請手動複製網址。', 'warning'));
          }} className="flex items-center gap-2 hover:text-[#006b2c] transition-colors text-left cursor-pointer">
            <Share2 className="w-4 h-4 text-zinc-400" />
            <span>分享應用程式</span>
          </button>
          <button onClick={() => {
            onNotify('騎跡是智能單車管理及綠色出行展示原型。', 'info');
          }} className="flex items-center gap-2 hover:text-[#006b2c] transition-colors text-left cursor-pointer">
            <HelpCircle className="w-4 h-4 text-zinc-400" />
            <span>系統說明</span>
          </button>
          <p className="not-italic font-normal mt-2">版本 1.2.0 • 創科署支持項目</p>
        </div>
      </motion.div>
    </div>
  );
}
