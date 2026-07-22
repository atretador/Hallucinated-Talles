import { motion, useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores';
import { coverApi } from '../../api/client';
import { useTranslation } from 'react-i18next';

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function EmptyState() {
  const { book, activeBookId } = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: 'easeOut' as const };

  const message = !book
    ? t('center.emptyState.noBook', { ns: 'app' })
    : t('center.emptyState.selectChapter', { ns: 'app' });

  // Show cover image if a book is loaded and has a front cover
  const hasCover = book?.covers?.frontCover && activeBookId;
  const coverSrc = hasCover ? coverApi.getImageUrl('front-cover') : null;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center p-8"
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
    >
      {coverSrc ? (
        <div className="mb-4">
          <img
            src={coverSrc}
            alt={`${book?.title ?? 'Book'} cover`}
            className="h-48 w-auto rounded-md shadow-lg ring-1 ring-gray-700 object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="text-gray-400 mb-2">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d={!book
                ? 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                : 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
              }
            />
          </svg>
        </div>
      )}
      <p className="text-gray-400 text-sm">{message}</p>
    </motion.div>
  );
}
