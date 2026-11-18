import { cn } from '@/lib/utils';

export type QuestionStatus = 'answered' | 'not-answered' | 'current' | 'marked';

interface QuestionPaletteProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<number, string>;
  markedForReview: Set<number>;
  questionIds: number[];
  onJumpTo: (index: number) => void;
}

function getStatus(
  index: number,
  currentIndex: number,
  questionId: number,
  answers: Record<number, string>,
  markedForReview: Set<number>
): QuestionStatus {
  if (index === currentIndex) return 'current';
  if (markedForReview.has(questionId)) return 'marked';
  if (answers[questionId]) return 'answered';
  return 'not-answered';
}

const statusStyles: Record<QuestionStatus, string> = {
  answered: 'bg-emerald-500 text-white border-emerald-600 shadow-sm',
  'not-answered': 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  current: 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-md',
  marked: 'bg-amber-500 text-white border-amber-600 shadow-sm',
};

export function QuestionPalette({
  totalQuestions,
  currentIndex,
  answers,
  markedForReview,
  questionIds,
  onJumpTo,
}: QuestionPaletteProps) {
  const answeredCount = questionIds.filter(id => answers[id]).length;
  const markedCount = markedForReview.size;
  const notAnsweredCount = totalQuestions - answeredCount;

  return (
    <div className="card-elevated rounded-2xl p-4">
      <h3 className="font-heading font-semibold text-sm mb-3 text-foreground">Question Palette</h3>

      {/* Grid of question buttons */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {questionIds.map((qId, idx) => {
          const status = getStatus(idx, currentIndex, qId, answers, markedForReview);
          return (
            <button
              key={qId}
              onClick={() => onJumpTo(idx)}
              className={cn(
                'w-9 h-9 rounded-lg border text-xs font-bold transition-all duration-200 flex items-center justify-center',
                statusStyles[status]
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-1.5 pt-3 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Legend</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-4 h-4 rounded bg-emerald-500 inline-block" />
          <span className="text-foreground">Answered ({answeredCount})</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-4 h-4 rounded bg-muted border border-border inline-block" />
          <span className="text-foreground">Not Answered ({notAnsweredCount})</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-4 h-4 rounded bg-primary inline-block" />
          <span className="text-foreground">Current</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-4 h-4 rounded bg-amber-500 inline-block" />
          <span className="text-foreground">Marked for Review ({markedCount})</span>
        </div>
      </div>
    </div>
  );
}
