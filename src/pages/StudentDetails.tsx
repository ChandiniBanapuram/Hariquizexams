import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExamHeader } from '@/components/ExamHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useExam } from '@/context/ExamContext';
import {
  studentDetailsSchema,
  StudentDetails,
} from '@/lib/validation';
import { studentAPI } from '@/lib/api';
import { useLookupData, useLookupSubjects } from '@/hooks/use-lookup-data';
import { cn } from '@/lib/utils';
import {
  Loader2,
  GraduationCap,
  User,
  Hash,
  Building,
  Users,
  Calendar as CalendarLucide,
  BookOpen,
  FileText,
  CalendarIcon,
} from 'lucide-react';

export default function StudentDetailsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setStudentDetails, setQuestions, setTimeLimit } = useExam();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentDetails>({
    resolver: zodResolver(studentDetailsSchema),
  });

  const department = watch('department');
  const section = watch('section');
  const year = watch('year');
  const semester = watch('semester');
  const subject = watch('subject');
  const examDate = watch('examDate');

  const { departments: DEPARTMENTS, sections: SECTIONS, years: YEARS, semesters: SEMESTERS } = useLookupData(true);
  const { subjects: subjectOptions } = useLookupSubjects(department, year, semester);

  const onSubmit = async (data: StudentDetails) => {
    setIsLoading(true);

    try {
      // ✅ NORMALIZATION (FIX)
      const normalizedSection =
        data.section === 'Section A'
          ? 'A'
          : data.section === 'Section B'
          ? 'B'
          : data.section;

      const normalizedDepartment = data.department.replace(/\s+/g, '');

      // ✅ PARALLEL API CALLS - fetch exam config, duplicate check, and questions simultaneously
      const [examConfig, duplicateCheck, questions] = await Promise.all([
        studentAPI.getExamConfig(
          normalizedDepartment,
          normalizedSection,
          data.year,
          data.semester,
          data.subject,
          data.examDate
        ),
        studentAPI.checkDuplicateAttempt(
          data.rollNumber,
          normalizedDepartment,
          normalizedSection,
          data.year,
          data.semester,
          data.subject,
          data.examDate
        ),
        studentAPI.getQuestions(
          normalizedDepartment,
          normalizedSection,
          data.year,
          data.semester,
          data.subject,
          data.examDate
        ),
      ]);

      // ✅ VALIDATE EXAM CONFIG
      // MySQL returns TINYINT as 0/1, handle both boolean and number comparison
      if (!examConfig || !examConfig.is_active || examConfig.is_active === 0) {
        toast({
          title: 'Exam Not Available',
          description: 'The exam for this subject is currently not active. Please contact your instructor.',
          variant: 'destructive',
        });
        return;
      }

      // ✅ STRICT: Block duplicate same-day attempts
      if (duplicateCheck && duplicateCheck.isDuplicate) {
        toast({
          title: 'Already Attempted',
          description: 'You already attempted this test.',
          variant: 'destructive',
        });
        return;
      }

      // ✅ VALIDATE QUESTIONS
      if (!Array.isArray(questions) || questions.length === 0) {
        toast({
          title: 'No Questions Available',
          description: 'There are no questions available for the selected date and criteria.',
          variant: 'destructive',
        });
        return;
      }

      // Clean up previous exam session data so new exam starts completely fresh
      localStorage.removeItem('examStarted');
      localStorage.removeItem('examEndTime');
      localStorage.removeItem('examAnswers');
      localStorage.removeItem('examCurrentQuestionIndex');
      localStorage.removeItem('examVisitedQuestions');
      localStorage.removeItem('examMarkedForReview');
      localStorage.removeItem('examHasSubmitted');
      localStorage.removeItem('examResult');

      // Get time limit from exam config
      const examTimeLimit = examConfig.time_limit || 15;
      setTimeLimit(examTimeLimit);

      // ✅ STORE ORIGINAL DATA (UNCHANGED)
      setStudentDetails(data);
      setQuestions(questions);
      navigate('/exam');

    } catch {
      toast({
        title: 'Error',
        description: 'Unable to start exam. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ExamHeader />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mx-auto max-w-lg">
          <div className="card-elevated rounded-2xl p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Student Details</h2>
              <p className="text-muted-foreground">
                Enter your details to start the exam
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label>
                  <Hash className="inline mr-2 h-4 w-4" />
                  Roll Number
                </Label>
                <Input
                  placeholder="e.g. 26ET103061"
                  {...register('rollNumber', {
                    onChange: e =>
                      (e.target.value = e.target.value.toUpperCase()),
                  })}
                />
                {errors.rollNumber && (
                  <p className="text-destructive">
                    {errors.rollNumber.message}
                  </p>
                )}
              </div>

              <div>
                <Label>
                  <User className="inline mr-2 h-4 w-4" />
                  Full Name
                </Label>
                <Input {...register('name')} />
                {errors.name && (
                  <p className="text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label>
                  <Building className="inline mr-2 h-4 w-4" />
                  Department
                </Label>
                <Select
                  value={department}
                  onValueChange={v =>
                    setValue('department', v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p className="text-destructive">
                    {errors.department.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    <CalendarLucide className="inline mr-2 h-4 w-4" />
                    Year
                  </Label>
                  <Select
                    value={year}
                    onValueChange={v =>
                      setValue('year', v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => (
                        <SelectItem key={y.value} value={y.value}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.year && (
                    <p className="text-destructive">{errors.year.message}</p>
                  )}
                </div>

                <div>
                  <Label>
                    <BookOpen className="inline mr-2 h-4 w-4" />
                    Semester
                  </Label>
                  <Select
                    value={semester}
                    onValueChange={v =>
                      setValue('semester', v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.semester && (
                    <p className="text-destructive">{errors.semester.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>
                  <Users className="inline mr-2 h-4 w-4" />
                  Section
                </Label>
                <Select
                  value={section}
                  onValueChange={v =>
                    setValue('section', v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.section && (
                  <p className="text-destructive">
                    {errors.section.message}
                  </p>
                )}
              </div>

              <div>
                <Label>
                  <FileText className="inline mr-2 h-4 w-4" />
                  Subject
                </Label>
                <Select
                  value={subject}
                  onValueChange={v =>
                    setValue('subject', v, { shouldValidate: true })
                  }
                  disabled={subjectOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={subjectOptions.length === 0 ? 'Select year & semester first' : 'Select subject'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subject && (
                  <p className="text-destructive">
                    {errors.subject.message}
                  </p>
                )}
              </div>

              <div>
                <Label>
                  <CalendarIcon className="inline mr-2 h-4 w-4" />
                  Exam Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !examDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {examDate ? examDate : <span>Select exam date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={examDate ? new Date(examDate) : undefined}
                      onSelect={(date) => setValue('examDate', date ? format(date, 'yyyy-MM-dd') : '', { shouldValidate: true })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {errors.examDate && (
                  <p className="text-destructive">
                    {errors.examDate.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'Start Exam'
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
