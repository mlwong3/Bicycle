import { motion } from 'motion/react';

interface NavigationPanelProps {
  spotName: string;
  progress: number;
  message: string;
  onStop: () => void;
}

// 地圖下方導航進度面板（模擬導航的進度條與語音指示）。
// 進出場動畫由外層 MapTab 的 motion.div 包裝負責。
export default function NavigationPanel({ spotName, progress, message, onStop }: NavigationPanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl shadow-2xl p-4 font-sans">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-[9px] font-black text-[#006b2c] uppercase tracking-wider">正在進行智能導航</h4>
          <p className="text-xs font-bold text-white mt-0.5 leading-tight">{spotName}</p>
        </div>
        <button
          onClick={onStop}
          className="text-[10px] text-zinc-400 hover:text-white font-black px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          結束導航
        </button>
      </div>

      <div className="space-y-2.5 my-3">
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <motion.div
            className="bg-[#006b2c] h-full"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-[11px] text-zinc-300 min-h-[30px] leading-relaxed font-semibold">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-bold border-t border-zinc-800/60 pt-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 block animate-pulse" />
        <span>GPS 與 CSDI 空間路網串接成功</span>
      </div>
    </div>
  );
}
