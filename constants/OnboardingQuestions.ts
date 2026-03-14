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
    id: "goal",
    title: "What's your main goal?",
    subtitle: "This helps us personalize your experience",
    options: [
      { id: "learn", emoji: "📚", label: "Learn something new" },
      { id: "organize", emoji: "📋", label: "Stay organized" },
      { id: "connect", emoji: "🤝", label: "Connect with others" },
      { id: "fun", emoji: "🎉", label: "Have fun" },
      { id: "health", emoji: "💪", label: "Get healthier" },
    ],
  },
  {
    id: "source",
    title: "How did you hear about us?",
    subtitle: "We'd love to know what brought you here",
    options: [
      { id: "social", emoji: "📱", label: "Social media" },
      { id: "friend", emoji: "👫", label: "Friend or family" },
      { id: "appstore", emoji: "🏠", label: "App Store" },
      { id: "search", emoji: "🔍", label: "Online search" },
    ],
  },
  {
    id: "identity",
    title: "What best describes you?",
    subtitle: "Help us understand who you are",
    options: [
      { id: "student", emoji: "🎓", label: "Student" },
      { id: "professional", emoji: "💼", label: "Professional" },
      { id: "hobbyist", emoji: "🎨", label: "Hobbyist" },
      { id: "parent", emoji: "👨‍👩‍👧‍👦", label: "Parent" },
    ],
  },
  {
    id: "frequency",
    title: "How often do you plan to use this app?",
    subtitle: "No pressure — there's no wrong answer",
    options: [
      { id: "daily", emoji: "☀️", label: "Daily" },
      { id: "few_times", emoji: "📅", label: "A few times a week" },
      { id: "weekly", emoji: "🗓️", label: "Weekly" },
      { id: "trying", emoji: "👋", label: "Just trying it out" },
    ],
  },
  {
    id: "features",
    title: "What features interest you most?",
    subtitle: "We'll highlight what matters to you",
    options: [
      { id: "recommendations", emoji: "✨", label: "Personalized recommendations" },
      { id: "community", emoji: "👥", label: "Community" },
      { id: "tracking", emoji: "📊", label: "Tracking progress" },
      { id: "learning", emoji: "🧠", label: "Learning new things" },
    ],
  },
];
