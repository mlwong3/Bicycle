import { motion } from 'motion/react';
import { X, Shield, Eye, HelpCircle, HardDrive, Trash2, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetData: () => void;
}

export default function SettingsModal({ isOpen, onClose, onResetData }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div id="settings-overlay-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-5 shadow-2xl max-w-sm w-full border border-zinc-100 font-sans text-zinc-800"
      >
        <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100 mb-4">
          <h3 className="text-sm font-bold text-zinc-900">單車管理設定</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Item 1: Device Security flag */}
          <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl">
            <Shield className="w-5 h-5 text-[#006b2c] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-900">裝置晶片安全保證</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                NFC 感應貼紙資料皆經 256 位元端對端雜湊編碼加密，保障個人隱私和防盜追蹤金鑰安全性。
              </p>
            </div>
          </div>

          {/* Item 2: Display Density */}
          <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl">
            <Eye className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-900">高對比度地圖模式</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                整合優化後的防強光視覺配色，確保於戶外豔陽下騎行時仍能清晰辨明單車路徑資訊。
              </p>
            </div>
          </div>

          {/* Item 3: Data purge */}
          <div className="p-3 border border-rose-100 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-500">
              <HardDrive className="w-4.5 h-4.5" />
              <p className="font-bold">本地端 LocalStorage 管理</p>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              重設所有自訂資料（包括您的舉報、新單車、收藏紀錄與積分）。重設後，網頁將恢復原出廠 Demo 初始值。
            </p>
            <button
              id="settings-reset-all-btn"
              onClick={() => {
                const confirmed = window.confirm('您確定要還原所有資料嗎？這將刪除所有在本地登錄的單車和檢舉紀錄。');
                if (confirmed) {
                  onResetData();
                  onClose();
                }
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-[10px] border border-rose-200/50 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              重置應用程式資料
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3.5 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#006b2c] hover:bg-[#005320] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-colors"
          >
            關閉
          </button>
        </div>
      </motion.div>
    </div>
  );
}
