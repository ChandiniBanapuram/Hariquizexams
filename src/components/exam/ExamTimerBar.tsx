import { Clock, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ExamTimerBarProps {
  subject: string;
  timeLeft: number;
  totalTime: number;
  answeredCount: number;
  totalQuestions: number;
}

export function ExamTimerBar({ subject, timeLeft, totalTime, answeredCount, totalQuestions }: ExamTimerBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLow = timeLeft <= 60;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Subject */}
          <div className="hidden md:block">
            <p className="font-heading font-semibold text-sm text-foreground truncate max-w-[200px]">{subject}</p>
            <p className="text-xs text-muted-foreground">Answered: {answeredCount} / {totalQuestions}</p>
          </div>

          {/* Progress bar */}
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Timer */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 font-mono transition-colors',
              isLow
                ? 'bg-destructive/10 border border-destructive/30 animate-pulse'
                : 'bg-primary/10 border border-primary/20'
            )}
          >
            {isLow ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Clock className="h-4 w-4 text-primary" />
            )}
            <span
              className={cn(
                'text-lg font-bold',
                isLow ? 'text-destructive' : 'text-primary'
              )}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Mobile answered count */}
          <div className="sm:hidden text-xs text-muted-foreground">
            {answeredCount}/{totalQuestions}
          </div>
        </div>
      </div>
    </div>
  );
}
