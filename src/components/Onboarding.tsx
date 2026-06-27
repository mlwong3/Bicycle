import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ONBOARDING_PAGES } from '../data';
import { ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentPage < ONBOARDING_PAGES.length - 1) {
      setDirection(1);
      setCurrentPage((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const setPage = (index: number) => {
    setDirection(index > currentPage ? 1 : -1);
    setCurrentPage(index);
  };

  const page = ONBOARDING_PAGES[currentPage];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div id="onboarding-root" className="fixed inset-0 bg-white z-50 flex flex-col h-screen overflow-hidden text-zinc-900 font-sans">
      {/* Skip Button */}
      <button 
        id="onboarding-skip-btn"
        onClick={onComplete}
        className="absolute top-6 right-6 z-10 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full text-sm font-medium transition-colors"
      >
        跳過
      </button>

      {/* Main Slider Area */}
      <div id="onboarding-swiper" className="flex-1 flex flex-col relative w-full h-full justify-between pb-24 md:pb-32">
        <div id="onboarding-illustration-container" className="flex-1 w-full bg-[#f9fafb] flex items-center justify-center p-6 min-h-[40vh]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="w-full max-w-md flex justify-center items-center"
            >
              <img 
                id={`onboarding-img-${currentPage}`}
                src={page.imageUrl} 
                alt={page.alt} 
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[45vh] object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Text Container */}
        <div 
          id="onboarding-text-container" 
          className="bg-white rounded-t-[32px] -mt-10 z-10 px-8 pt-10 flex flex-col items-center text-center shadow-[0_-4px_24px_rgba(0,0,0,0.02)]"
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="max-w-md"
            >
              <h2 id="onboarding-title-text" className="text-2xl font-bold text-[#006b2c] tracking-tight mb-4">
                {page.title}
              </h2>
              <p id="onboarding-desc-text" className="text-sm md:text-base text-zinc-500 leading-relaxed max-w-sm mx-auto">
                {page.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Start Button on Last Page */}
          {currentPage === ONBOARDING_PAGES.length - 1 ? (
            <motion.button
              id="onboarding-start-btn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onComplete}
              className="w-full max-w-xs bg-[#006b2c] hover:bg-[#005320] text-white font-semibold py-4 rounded-full mt-8 mb-4 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              立即開始
              <ArrowRight id="onboarding-start-arrow" className="w-5 h-5" />
            </motion.button>
          ) : (
            <button
              id="onboarding-next-btn"
              onClick={handleNext}
              className="w-full max-w-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold py-4 rounded-full mt-8 mb-4 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              繼續
            </button>
          )}
        </div>
      </div>

      {/* Slide Indicators */}
      <div id="onboarding-dots" className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-2 z-20 pointer-events-auto">
        {ONBOARDING_PAGES.map((_, index) => (
          <button
            key={index}
            id={`onboarding-dot-${index}`}
            onClick={() => setPage(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentPage ? 'bg-[#006b2c] w-6' : 'bg-zinc-300 w-2 hover:bg-zinc-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
