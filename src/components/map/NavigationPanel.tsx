import { motion } from 'motion/react';

interface NavigationPanelProps {
  spotName: string;
  progress: number;
  message: string;
  distanceKm: number;
  etaMin: number;
  /** gps = 以真實 GPS 追蹤推進；demo = 未取得定位時的示範播放 */
  mode: 'gps' | 'demo';
  onStop: () => void;
}

// 地圖下方導航進度面板（真實 GPS 追蹤或示範播放的進度條與轉向指示）。
// 進出場動畫由外層 MapTab 的 motion.div 包裝負責。
export default function NavigationPanel({ spotName, progress, message, distanceKm, etaMin, mode, onStop }: NavigationPanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl shadow-2xl p-4 font-sans">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-[9px] font-black text-[#006b2c] uppercase tracking-wider">
            {mode === 'gps' ? '真實 GPS 導航中' : '路線預覽（示範模式）'}
          </h4>
          <p className="text-xs font-bold text-white mt-0.5 leading-tight">{spotName}</p>
        </div>
        <button
          onClick={onStop}
          className="text-[10px] text-zinc-400 hover:text-white font-black px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          結束導航
        </button>
      </div>

      {/* 距離與以 10 km/h 估算的時間 */}
      {distanceKm > 0 && (
        <div className="flex items-stretch gap-2 mb-3">
          <div className="flex-1 bg-zinc-800/70 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-500 font-bold">全程距離</p>
            <p className="text-sm font-black text-white leading-tight">{distanceKm.toFixed(1)} <span className="text-[10px] font-bold text-zinc-400">km</span></p>
          </div>
          <div className="flex-1 bg-zinc-800/70 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-500 font-bold">預計時間 (10 km/h)</p>
            <p className="text-sm font-black text-white leading-tight">{Math.round(etaMin)} <span className="text-[10px] font-bold text-zinc-400">分鐘</span></p>
          </div>
        </div>
      )}

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
        <span className={`w-1.5 h-1.5 rounded-full block ${mode === 'gps' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
        <span>
          {mode === 'gps'
            ? '正依 GPS 實時位置沿 Mapbox 單車路線推進'
            : '未取得 GPS 定位，以示範速度播放路線'}
        </span>
      </div>
    </div>
  );
}
