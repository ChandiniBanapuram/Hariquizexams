import { ExamHeader } from '@/components/ExamHeader';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Clock, FileText, Shield } from 'lucide-react';

interface ExamInstructionsProps {
  subject: string;
  totalQuestions: number;
  timeLimit: number;
  onAgree: () => void;
}

export function ExamInstructions({ subject, totalQuestions, timeLimit, onAgree }: ExamInstructionsProps) {
  return (
    <div className="min-h-screen bg-background">
      <ExamHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl animate-slide-up">
          <div className="card-elevated rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Exam Instructions</h2>
              <p className="text-muted-foreground mt-1">{subject}</p>
            </div>

            {/* Exam Details */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{totalQuestions}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-primary/10">
                <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{timeLimit}</p>
                <p className="text-xs text-muted-foreground">Minutes</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{totalQuestions}</p>
                <p className="text-xs text-muted-foreground">Total Marks</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3 mb-8">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> General Instructions
              </h3>
              <ul className="space-y-2.5 text-sm text-foreground">
                {[
                  'Each question carries 1 mark. There is no negative marking.',
                  `Total duration of the exam is ${timeLimit} minutes.`,
                  'The exam will auto-submit when the timer reaches zero.',
                  'You can navigate between questions using the question palette.',
                  'You can mark questions for review and come back to them later.',
                  'Use "Save & Next" to save your answer and move to the next question.',
                  'Use "Clear Response" to remove your selected answer.',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 mb-8">
              <h3 className="font-heading font-semibold text-destructive flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" /> Important Warnings
              </h3>
              <ul className="space-y-2 text-sm text-foreground">
                {[
                  'Do NOT switch tabs or windows — your exam will be auto-submitted.',
                  'Do NOT exit fullscreen mode during the exam.',
                  'Do NOT refresh the page — your progress will be lost.',
                  'Right-click, copy, paste and keyboard shortcuts are disabled.',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Agree Button */}
            <Button onClick={onAgree} className="w-full gradient-primary text-white h-12 text-base font-semibold">
              I Agree — Start Exam
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
