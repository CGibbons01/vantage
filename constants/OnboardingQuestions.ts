export interface OnboardingOption {
  id: string;
  emoji: string;
  label: string;
}

export interface OnboardingQuestion {
  id: string;
  title: string;
  subtitle: string;
  options: OnboardingOption[];
}

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: "situation",
    title: "What best describes your current situation?",
    subtitle: "This helps us tailor your job recommendations",
    options: [
      { id: "actively_hunting", emoji: "🎯", label: "Actively job hunting" },
      { id: "open", emoji: "👀", label: "Open to opportunities" },
      { id: "exploring", emoji: "🧭", label: "Just exploring" },
    ],
  },
  {
    id: "experience",
    title: "What's your experience level?",
    subtitle: "We'll match you with roles that fit your background",
    options: [
      { id: "entry", emoji: "🌱", label: "Entry level (0–2 years)" },
      { id: "mid", emoji: "💼", label: "Mid level (3–7 years)" },
      { id: "senior", emoji: "🏆", label: "Senior (8+ years)" },
    ],
  },
  {
    id: "industry",
    title: "Which industry are you targeting?",
    subtitle: "Pick the sector you want to work in",
    options: [
      { id: "tech", emoji: "💻", label: "Technology & Engineering" },
      { id: "finance", emoji: "📈", label: "Finance & Business" },
      { id: "healthcare", emoji: "🏥", label: "Healthcare & Science" },
      { id: "creative", emoji: "🎨", label: "Creative & Marketing" },
      { id: "other", emoji: "🌐", label: "Other" },
    ],
  },
  {
    id: "role_type",
    title: "What type of role are you looking for?",
    subtitle: "We'll filter results to match your preference",
    options: [
      { id: "fulltime", emoji: "🏢", label: "Full-time" },
      { id: "parttime", emoji: "⏱️", label: "Part-time / Contract" },
      { id: "remote", emoji: "🏠", label: "Remote only" },
    ],
  },
  {
    id: "priority",
    title: "What matters most to you in a new role?",
    subtitle: "Your top priority shapes how we rank opportunities",
    options: [
      { id: "salary", emoji: "💰", label: "Salary & benefits" },
      { id: "growth", emoji: "🚀", label: "Career growth" },
      { id: "balance", emoji: "⚖️", label: "Work-life balance" },
      { id: "culture", emoji: "🤝", label: "Company culture" },
    ],
  },
];
